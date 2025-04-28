import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  setDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  increment,
  Timestamp,
  writeBatch,
} from "firebase/firestore";
import { db } from "../config/firebase";
import notificationService from "./notificationService";
import { getFunctions, httpsCallable } from "firebase/functions";

class WalletService {
  /**
   * Get a user's wallet
   * @param {string} userId - User ID
   * @returns {Promise<Object|null>} Wallet data or null if not found
   */
  async getUserWallet(userId) {
    try {
      const walletRef = doc(db, "wallets", userId);
      const walletDoc = await getDoc(walletRef);

      if (!walletDoc.exists()) {
        return await this.initializeWallet(userId);
      }

      return walletDoc.data();
    } catch (error) {
      console.error("Error getting wallet:", error);
      throw error;
    }
  }

  /**
   * Initialize a wallet for a new user
   * @param {string} userId - User ID
   * @returns {Promise<Object>} The initialized wallet
   */
  async initializeWallet(userId) {
    try {
      const walletData = {
        balance: 1000, // Starting balance for new users
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const walletRef = doc(db, "wallets", userId);
      await setDoc(walletRef, walletData);

      // Create an initial transaction record
      await this.recordTransaction(userId, {
        type: "deposit",
        amount: 1000,
        description: "Welcome bonus!",
        status: "completed",
      });

      return walletData;
    } catch (error) {
      console.error("Error initializing wallet:", error);
      throw error;
    }
  }

  /**
   * Get wallet balance
   * @param {string} userId - User ID
   * @returns {Promise<number>} Wallet balance
   */
  async getWalletBalance(userId) {
    try {
      const wallet = await this.getUserWallet(userId);
      return wallet ? wallet.balance : 0;
    } catch (error) {
      console.error("Error getting wallet balance:", error);
      return 0;
    }
  }

  /**
   * Record a transaction in the user's history
   * @param {string} userId - User ID
   * @param {Object} transactionData - Transaction data
   * @returns {Promise<Object>} Transaction document
   */
  async recordTransaction(userId, transactionData) {
    try {
      const transactionRef = collection(db, "transactions");

      const transaction = {
        userId,
        ...transactionData,
        createdAt: serverTimestamp(),
      };

      const docRef = await addDoc(transactionRef, transaction);

      return {
        id: docRef.id,
        ...transaction,
      };
    } catch (error) {
      console.error("Error recording transaction:", error);
      throw error;
    }
  }

  /**
   * Transfer funds to another user
   * @param {string} fromUserId - Sender user ID
   * @param {string} toEmail - Recipient email address
   * @param {number} amount - Amount to transfer
   * @param {string} note - Transfer note
   * @returns {Promise<Object>} Result with success status
   */
  async transferFunds(fromUserId, toEmail, amount, note = "") {
    try {
      // Validate inputs
      if (!fromUserId || !toEmail || !amount) {
        return {
          success: false,
          error: "Missing required fields",
        };
      }

      if (amount <= 0) {
        return {
          success: false,
          error: "Amount must be greater than 0",
        };
      }

      // Find user by email
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("email", "==", toEmail));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        return {
          success: false,
          error: "Recipient not found",
        };
      }

      const toUserDoc = querySnapshot.docs[0];
      const toUserId = toUserDoc.id;

      // Prevent transferring to self
      if (fromUserId === toUserId) {
        return {
          success: false,
          error: "Cannot transfer to yourself",
        };
      }

      // Check sender's wallet balance
      const fromWallet = await this.getUserWallet(fromUserId);
      if (fromWallet.balance < amount) {
        return {
          success: false,
          error: "Insufficient funds",
        };
      }

      // Update sender's wallet
      const fromWalletRef = doc(db, "wallets", fromUserId);
      await updateDoc(fromWalletRef, {
        balance: increment(-amount),
        updatedAt: serverTimestamp(),
      });

      // Record debit transaction
      await this.recordTransaction(fromUserId, {
        type: "transfer",
        amount: -amount,
        description: `Transfer to ${toEmail}${note ? ": " + note : ""}`,
        status: "completed",
        recipientId: toUserId,
        recipientEmail: toEmail,
      });

      // Update recipient's wallet
      const toWalletRef = doc(db, "wallets", toUserId);
      const toWalletDoc = await getDoc(toWalletRef);

      if (toWalletDoc.exists()) {
        // Update existing wallet
        await updateDoc(toWalletRef, {
          balance: increment(amount),
          updatedAt: serverTimestamp(),
        });
      } else {
        // Create new wallet
        await setDoc(toWalletRef, {
          userId: toUserId,
          balance: amount,
          currency: "USD",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      // Record credit transaction
      await this.recordTransaction(toUserId, {
        type: "transfer",
        amount: amount,
        description: `Transfer from ${
          (await getDoc(doc(db, "users", fromUserId))).data()?.email ||
          "another user"
        }${note ? ": " + note : ""}`,
        status: "completed",
        senderId: fromUserId,
      });

      // Send notifications to both users
      const notificationService = await import("./notificationService").then(
        (module) => module.default
      );
      await notificationService.sendTransferNotification(
        fromUserId,
        amount,
        false
      ); // false for withdrawal/send
      await notificationService.sendTransferNotification(
        toUserId,
        amount,
        true
      ); // true for deposit/receive

      return { success: true };
    } catch (error) {
      console.error("Error transferring funds:", error);
      throw error;
    }
  }

  /**
   * Simulate depositing funds into a wallet (for demo purposes)
   * @param {string} userId - User ID
   * @param {number} amount - Amount to deposit
   * @param {string} description - Transaction description
   * @returns {Promise<Object>} Result with success status
   */
  async simulateDeposit(userId, amount, description = "Deposit") {
    try {
      // First, verify that the user has admin role
      const userRef = doc(db, "users", userId);
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) {
        return { success: false, error: "User not found" };
      }

      const userData = userDoc.data();
      const userRoles = Array.isArray(userData.roles)
        ? userData.roles
        : userData.role
        ? [userData.role]
        : ["customer"];

      // Only allow admins to deposit funds
      if (!userRoles.includes("admin")) {
        return {
          success: false,
          error: "Only administrators can add credits to wallets",
        };
      }

      // Update the wallet balance
      const walletRef = doc(db, "wallets", userId);
      await updateDoc(walletRef, {
        balance: increment(amount),
        updatedAt: serverTimestamp(),
      });

      // Record the transaction
      await this.recordTransaction(userId, {
        type: "deposit",
        amount: amount,
        description,
        status: "completed",
      });

      // Send notification for successful deposit
      const notificationService = await import("./notificationService").then(
        (module) => module.default
      );
      await notificationService.sendTransferNotification(userId, amount, true); // true for deposit

      return { success: true };
    } catch (error) {
      console.error("Error simulating deposit:", error);
      throw error;
    }
  }

  /**
   * Deduct funds from a user's wallet (for payments, etc.)
   * @param {string} userId - User ID
   * @param {number} amount - Amount to deduct
   * @param {string} description - Transaction description
   * @returns {Promise<Object>} Result with success status
   */
  async deductFunds(userId, amount, description = "Payment") {
    try {
      // Check wallet balance first
      const wallet = await this.getUserWallet(userId);
      if (wallet.balance < amount) {
        return { success: false, error: "Insufficient funds" };
      }

      // Update the wallet balance
      const walletRef = doc(db, "wallets", userId);
      await updateDoc(walletRef, {
        balance: increment(-amount),
        updatedAt: serverTimestamp(),
      });

      // Record the transaction
      await this.recordTransaction(userId, {
        type: "purchase",
        amount: -amount,
        description,
        status: "completed",
      });

      // Send notification for withdrawal
      const notificationService = await import("./notificationService").then(
        (module) => module.default
      );
      await notificationService.sendTransferNotification(userId, amount, false); // false for withdrawal

      return { success: true };
    } catch (error) {
      console.error("Error deducting funds:", error);
      throw error;
    }
  }

  /**
   * Get transaction history for a user
   * @param {string} userId - User ID
   * @param {number} limit - Maximum number of transactions to return
   * @returns {Promise<Array>} - Transaction history
   */
  async getTransactionHistory(userId, limitCount = 50) {
    try {
      const transactionsRef = collection(db, "transactions");

      // Try using a simpler query first, then sort client-side to avoid index issues
      let q = query(
        transactionsRef,
        where("userId", "==", userId),
        limit(limitCount)
      );

      try {
        const snapshot = await getDocs(q);

        // Sort on client side
        const transactions = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        // Sort by createdAt in descending order (newest first)
        return transactions.sort((a, b) => {
          const dateA = a.createdAt?.toDate?.() || new Date(0);
          const dateB = b.createdAt?.toDate?.() || new Date(0);
          return dateB - dateA;
        });
      } catch (error) {
        // If there's an index error, log it and try without sorting
        console.error(
          "Index error for transactions. Falling back to unordered query:",
          error
        );

        // Simpler query without ordering
        q = query(
          transactionsRef,
          where("userId", "==", userId),
          limit(limitCount)
        );

        const snapshot = await getDocs(q);

        // Sort on client side
        const transactions = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        // Sort by createdAt in descending order (newest first)
        return transactions.sort((a, b) => {
          const dateA = a.createdAt?.toDate?.() || new Date(0);
          const dateB = b.createdAt?.toDate?.() || new Date(0);
          return dateB - dateA;
        });
      }
    } catch (error) {
      console.error("Error getting transaction history:", error);
      return [];
    }
  }

  /**
   * Fund a product (invest in it)
   * @param {string} userId - Investor's user ID
   * @param {string} productId - Product ID
   * @param {number} amount - Amount to invest
   * @param {Object} productData - Product data
   * @returns {Promise<Object>} - Result of investment
   */
  async fundProduct(userId, productId, amount, productData) {
    try {
      // Check if user has sufficient funds
      const walletDoc = await this.getUserWallet(userId);

      if (!walletDoc || walletDoc.balance < amount) {
        return {
          success: false,
          error: "Insufficient funds for this investment",
        };
      }

      // Get full product data if designerId is missing
      let designerId;
      if (!productData.designerId) {
        try {
          const productRef = doc(db, "products", productId);
          const productDoc = await getDoc(productRef);
          if (productDoc.exists()) {
            designerId = productDoc.data().designerId;
          }
        } catch (err) {
          console.error("Error fetching complete product data:", err);
        }
      } else {
        designerId = productData.designerId;
      }

      // Begin transaction to update wallet, add investment, and update product funding
      const batch = writeBatch(db);

      // 1. Deduct from wallet
      const walletRef = doc(db, "wallets", userId);
      batch.update(walletRef, {
        balance: increment(-amount),
      });

      // 2. Create investment record
      const investmentRef = doc(collection(db, "investments"));
      batch.set(investmentRef, {
        userId,
        productId,
        designerId, // This might still be undefined, but at least we tried to get it
        amount,
        createdAt: serverTimestamp(),
        status: "completed",
        transactionId: investmentRef.id,
        productName: productData.name || "Unknown Product",
      });

      // 3. Update product funding
      const productRef = doc(db, "products", productId);
      batch.update(productRef, {
        currentFunding: increment(amount),
        investorCount: increment(1),
        lastFundedAt: serverTimestamp(),
      });

      // 4. Add transaction record
      const transactionRef = doc(collection(db, "transactions"));
      batch.set(transactionRef, {
        userId,
        amount: -amount,
        type: "investment",
        description: `Investment in ${productData.name || "product"}`,
        productId,
        createdAt: serverTimestamp(),
        status: "completed",
      });

      // Commit all changes
      await batch.commit();

      return {
        success: true,
        message: `Successfully invested $${amount} in ${productData.name}`,
        investmentId: investmentRef.id,
        newTotal: amount, // Return the amount to indicate new funding total
      };
    } catch (error) {
      console.error("Error funding product:", error);
      return {
        success: false,
        error: error.message || "Failed to process investment",
      };
    }
  }

  /**
   * Process business commission for a sale
   * @param {number} saleAmount - The total sale amount
   * @param {number} manufacturingCost - The manufacturing cost per unit
   * @param {number} quantity - The quantity of items sold
   * @param {string} productId - The product ID
   * @param {string} productName - The product name
   * @returns {Promise<Object>} Result with success status and commission amount
   */
  async processBusinessCommission(
    saleAmount,
    manufacturingCost,
    quantity = 1,
    productId,
    productName
  ) {
    try {
      // Get business account settings
      const settingsRef = doc(db, "settings", "businessAccount");
      const settingsDoc = await getDoc(settingsRef);

      // If settings don't exist or commission is disabled, no commission is taken
      if (!settingsDoc.exists() || !settingsDoc.data().enabled) {
        return {
          success: true,
          commissionAmount: 0,
          message: "Business commission is disabled",
        };
      }

      // Get settings
      const settings = settingsDoc.data();
      const commissionRate = settings.commissionRate || 2.0; // Default to 2% if not specified

      // Calculate profit
      const totalManufacturingCost = manufacturingCost * quantity;
      const profit = Math.max(0, saleAmount - totalManufacturingCost);

      // Calculate commission (percentage of profit)
      const commission = profit * (commissionRate / 100);
      const roundedCommission = Math.round(commission * 100) / 100; // Round to 2 decimal places

      if (roundedCommission <= 0) {
        return {
          success: true,
          commissionAmount: 0,
          message: "No commission taken (zero or negative profit)",
        };
      }

      // Get business wallet reference
      const businessWalletRef = doc(db, "wallets", "business");
      const businessWalletDoc = await getDoc(businessWalletRef);

      // Create batch for transaction
      const batch = writeBatch(db);

      if (businessWalletDoc.exists()) {
        // Update existing wallet
        batch.update(businessWalletRef, {
          balance: increment(roundedCommission),
          updatedAt: serverTimestamp(),
        });
      } else {
        // Create business wallet if it doesn't exist
        batch.set(businessWalletRef, {
          balance: roundedCommission,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      // Record transaction for business account
      const transactionRef = doc(collection(db, "transactions"));
      batch.set(transactionRef, {
        userId: "business", // Special ID for business account
        amount: roundedCommission,
        type: "commission",
        description: `Commission from sale of ${productName || "product"}`,
        productId,
        commissionRate: settings.commissionRate,
        saleAmount,
        createdAt: serverTimestamp(),
        status: "completed",
      });

      // Commit the batch
      await batch.commit();

      return {
        success: true,
        commissionAmount: roundedCommission,
        commissionRate: settings.commissionRate,
        message: `Successfully processed ${
          settings.commissionRate
        }% commission of $${roundedCommission.toFixed(2)}`,
      };
    } catch (error) {
      console.error("Error processing business commission:", error);
      return {
        success: false,
        error: error.message || "Failed to process business commission",
        commissionAmount: 0,
      };
    }
  }

  /**
   * Distribute revenue to investors for a product sale
   * @param {string} productId - The product ID
   * @param {number} saleAmount - The total sale amount
   * @param {number} manufacturingCost - The manufacturing cost per unit
   * @param {number} quantity - The quantity of items sold
   * @param {string} orderId - The order ID
   * @returns {Promise<Object>} Result with success status and distribution info
   */
  async distributeInvestorRevenue(
    productId,
    saleAmount,
    manufacturingCost,
    quantity = 1,
    orderId
  ) {
    try {
      // Use Firebase Cloud Function to distribute revenue
      const functions = getFunctions();
      const distributeRevenue = httpsCallable(
        functions,
        "distributeInvestorRevenue"
      );

      const result = await distributeRevenue({
        productId,
        saleAmount,
        manufacturingCost,
        quantity,
        orderId,
      });

      return {
        success: true,
        data: result.data,
      };
    } catch (error) {
      console.error("Error distributing investor revenue:", error);
      return {
        success: false,
        error: error.message || "Failed to distribute investor revenue",
      };
    }
  }

  /**
   * Process a product sale - handles both business commission and investor revenue distribution
   * @param {string} productId - The product ID
   * @param {string} productName - The product name
   * @param {number} saleAmount - The total sale amount
   * @param {number} manufacturingCost - The manufacturing cost per unit
   * @param {number} quantity - The quantity of items sold
   * @param {string} orderId - The order ID
   * @returns {Promise<Object>} Result with status and processing details
   */
  async processProductSale(
    productId,
    productName,
    saleAmount,
    manufacturingCost,
    quantity = 1,
    orderId
  ) {
    try {
      // First, process business commission
      const commissionResult = await this.processBusinessCommission(
        saleAmount,
        manufacturingCost,
        quantity,
        productId,
        productName
      );

      // Next, distribute revenue to investors
      const distributionResult = await this.distributeInvestorRevenue(
        productId,
        saleAmount,
        manufacturingCost,
        quantity,
        orderId
      );

      return {
        success: true,
        commissionResult: commissionResult.success ? commissionResult : null,
        distributionResult: distributionResult.success
          ? distributionResult.data
          : null,
        message: "Sale processed successfully",
      };
    } catch (error) {
      console.error("Error processing product sale:", error);
      return {
        success: false,
        error: error.message || "Failed to process product sale",
      };
    }
  }
}

const walletService = new WalletService();
export default walletService;
