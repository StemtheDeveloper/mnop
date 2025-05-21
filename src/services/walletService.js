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
  arrayUnion,
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

      // Get current wallet balance to include with the transaction record
      let balanceSnapshot = 0;
      try {
        const walletRef = doc(db, "wallets", userId);
        const walletDoc = await getDoc(walletRef);
        if (walletDoc.exists()) {
          balanceSnapshot = walletDoc.data().balance || 0;
        }
      } catch (error) {
        console.error("Error getting balance snapshot:", error);
        // Continue with transaction creation even if balance fetch fails
      }

      const transaction = {
        userId,
        ...transactionData,
        balanceSnapshot, // Include the wallet balance at transaction time
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

      // Check if cancellation period testing is enabled and get the custom duration
      let cancellationPeriodInMinutes = 60; // Default is 1 hour (60 minutes)

      try {
        const settingsRef = doc(db, "settings", "paymentSettings");
        const settingsDoc = await getDoc(settingsRef);

        if (settingsDoc.exists()) {
          const settings = settingsDoc.data();

          if (settings.enableCancellationPeriodTesting) {
            cancellationPeriodInMinutes =
              settings.cancellationPeriodMinutes || 60;
            console.log(
              `[WalletService] Using test cancellation period: ${cancellationPeriodInMinutes} minutes`
            );
          }
        }
      } catch (settingsError) {
        console.error(
          "Error reading cancellation period settings:",
          settingsError
        );
        // Fallback to default value if there's an error
      }

      // Calculate cancellation period expiry
      const cancellationExpiryTime = new Date();
      cancellationExpiryTime.setMinutes(
        cancellationExpiryTime.getMinutes() + cancellationPeriodInMinutes
      );

      // Record the transaction with cancellation period info
      const transactionRef = await this.recordTransaction(userId, {
        type: "purchase",
        amount: -amount,
        description,
        status: "pending_confirmation",
        cancellationPeriod: true,
        cancellationExpiryTime: Timestamp.fromDate(cancellationExpiryTime),
        statusMessage: `Transaction is within ${cancellationPeriodInMinutes}-minute cancellation period. You may be eligible to cancel your order.`,
        createdAt: serverTimestamp(),
      });

      // Send notification for withdrawal
      const notificationService = await import("./notificationService").then(
        (module) => module.default
      );
      await notificationService.sendTransferNotification(userId, amount, false); // false for withdrawal

      return {
        success: true,
        transactionId: transactionRef.id,
        cancellationExpiryTime,
      };
    } catch (error) {
      console.error("Error deducting funds:", error);
      throw error;
    }
  }

  /**
   * Check and update transactions that have passed their cancellation period
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Result with success status and updated transactions
   */
  async updateTransactionCancellationStatus(userId) {
    try {
      const transactionsRef = collection(db, "transactions");
      // Query transactions that are still in cancellation period
      const q = query(
        transactionsRef,
        where("userId", "==", userId),
        where("cancellationPeriod", "==", true),
        where("status", "==", "pending_confirmation")
      );

      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        return {
          success: true,
          message: "No transactions in cancellation period found",
          updated: 0,
        };
      }

      const batch = writeBatch(db);
      const now = new Date();
      let updatedCount = 0;
      const updatedTransactions = [];

      for (const doc of snapshot.docs) {
        const transaction = doc.data();
        const transactionId = doc.id;
        const cancellationExpiryTime =
          transaction.cancellationExpiryTime?.toDate?.() ||
          new Date(transaction.cancellationExpiryTime);

        // If the cancellation period has expired
        if (now > cancellationExpiryTime) {
          batch.update(doc.ref, {
            status: "completed",
            cancellationPeriod: false,
            confirmedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            statusMessage: "Transaction confirmed after cancellation period",
          });

          updatedCount++;
          updatedTransactions.push({
            id: transactionId,
            ...transaction,
            status: "completed",
          });

          // Send notification to user that transaction is now confirmed
          try {
            const notificationService = await import(
              "./notificationService"
            ).then((module) => module.default);

            await notificationService.createNotification(
              userId,
              "transaction_confirmed",
              "Transaction Confirmed",
              `Your payment transaction of ${Math.abs(
                transaction.amount
              ).toFixed(2)} has been confirmed and is now final.`,
              "/wallet"
            );
          } catch (notifError) {
            console.error(
              "Error sending transaction confirmation notification:",
              notifError
            );
            // Continue execution even if notification fails
          }
        }
      }

      if (updatedCount > 0) {
        await batch.commit();
      }

      return {
        success: true,
        updated: updatedCount,
        updatedTransactions,
      };
    } catch (error) {
      console.error("Error updating transaction cancellation status:", error);
      return {
        success: false,
        error: error.message || "Failed to update transaction status",
      };
    }
  }

  /**
   * Add a method to add funds for refunds
   * @param {string} userId - User ID
   * @param {number} amount - Amount to add
   * @param {string} description - Transaction description
   * @returns {Promise<Object>} Result with success status
   */
  async addToWallet(userId, amount, description = "Refund") {
    try {
      if (!userId || !amount) {
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

      // Update the wallet balance
      const walletRef = doc(db, "wallets", userId);
      const walletDoc = await getDoc(walletRef);

      if (walletDoc.exists()) {
        // Update existing wallet
        await updateDoc(walletRef, {
          balance: increment(amount),
          updatedAt: serverTimestamp(),
        });
      } else {
        // Create wallet if it doesn't exist
        await setDoc(walletRef, {
          balance: amount,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      // Record the transaction
      await this.recordTransaction(userId, {
        type: "refund",
        amount: amount,
        description,
        status: "completed",
      });

      return { success: true };
    } catch (error) {
      console.error("Error adding funds to wallet:", error);
      return {
        success: false,
        error: error.message || "Failed to add funds to wallet",
      };
    }
  }

  /**
   * Get transaction history for a user
   * @param {string} userId - User ID
   * @param {number} limitCount - Maximum number of transactions to return
   * @returns {Promise<Array>} - Transaction history
   */
  async getTransactionHistory(userId, limitCount = 200) {
    try {
      console.log(
        `[WalletService] Getting transaction history for ${userId}, limit: ${limitCount}`
      );
      const transactionsRef = collection(db, "transactions");

      // Use a compound query with ordering for better results
      // This query pattern requires an index on userId + createdAt (desc)
      const q = query(
        transactionsRef,
        where("userId", "==", userId),
        orderBy("createdAt", "desc"), // Sort by createdAt in descending order
        limit(limitCount)
      );

      console.log("[WalletService] Executing transactions query");
      const snapshot = await getDocs(q);
      console.log(`[WalletService] Found ${snapshot.size} transactions`);

      // Map to proper transaction objects
      const transactions = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Return transactions already sorted by createdAt in descending order
      return transactions;
    } catch (error) {
      console.error("Error getting transaction history:", error);

      // If there's an index error, try again with the old query method
      if (error.message && error.message.includes("index")) {
        console.log(
          "[WalletService] Index error, falling back to simpler query"
        );
        try {
          // Fallback to simpler query without ordering
          const fallbackQuery = query(
            collection(db, "transactions"),
            where("userId", "==", userId),
            limit(limitCount)
          );

          const snapshot = await getDocs(fallbackQuery);
          console.log(
            `[WalletService] Fallback query found ${snapshot.size} transactions`
          );

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
        } catch (fallbackError) {
          console.error(
            "[WalletService] Even fallback query failed:",
            fallbackError
          );
          return []; // Return empty array if both approaches fail
        }
      }

      return []; // Return an empty array on error
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

      // 1. Deduct from user's wallet
      const walletRef = doc(db, "wallets", userId);
      batch.update(walletRef, {
        balance: increment(-amount),
      });

      // 2. Add funds to business wallet (this holds the money until manufacturing)
      const businessWalletRef = doc(db, "wallets", "business");
      const businessWalletDoc = await getDoc(businessWalletRef);

      if (businessWalletDoc.exists()) {
        // Update existing business wallet
        batch.update(businessWalletRef, {
          balance: increment(amount),
          updatedAt: serverTimestamp(),
        });
      } else {
        // Create business wallet if it doesn't exist
        batch.set(businessWalletRef, {
          balance: amount,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      // 3. Create investment record
      const investmentRef = doc(collection(db, "investments"));
      batch.set(investmentRef, {
        userId,
        productId,
        designerId,
        amount,
        createdAt: serverTimestamp(),
        status: "completed",
        transactionId: investmentRef.id,
        productName: productData.name || "Unknown Product",
        // Track that these funds are held in the business account
        heldInBusinessAccount: true,
      });

      // 4. Update product funding
      const productRef = doc(db, "products", productId);
      batch.update(productRef, {
        currentFunding: increment(amount),
        investorCount: increment(1),
        lastFundedAt: serverTimestamp(),
        // Add user to funders array if they're not already in it
        funders: arrayUnion(userId),
        // Add a record that this amount is held in the business account
        businessHeldFunds: increment(amount),
      });

      // 5. Add transaction records
      // 5.1 Record the investment for the user
      await this.recordTransaction(userId, {
        amount: -amount,
        type: "investment",
        description: `Investment in ${productData.name || "product"}`,
        productId,
        status: "completed",
      });

      // 5.2 Record the deposit to the business account
      await this.recordTransaction("business", {
        amount: amount,
        type: "funding_hold",
        description: `Holding funds for ${productData.name || "product"}`,
        productId,
        status: "pending", // Funds are pending until they can be sent to the manufacturer
        investmentId: investmentRef.id,
        investorId: userId,
      });

      // Commit all changes
      await batch.commit();

      // Send notification about the investment
      const notificationService = await import("./notificationService").then(
        (module) => module.default
      );

      // Notify the investor
      await notificationService.createNotification(
        userId,
        "investment",
        "Investment Successful",
        `Your investment of $${amount} in ${
          productData.name || "product"
        } has been processed.`,
        `/product/${productId}`
      );

      // Notify the designer if we have their ID
      if (designerId) {
        await notificationService.createNotification(
          designerId,
          "funding",
          "Product Received Funding",
          `Your product ${
            productData.name || "product"
          } received $${amount} in funding.`,
          `/product/${productId}`
        );
      }

      // Check if the product has reached its funding goal now
      const currentFunding = (productData.currentFunding || 0) + amount;
      const fundingGoal = productData.fundingGoal || 0;

      // If funding goal is reached, send notifications and check for auto-transfer
      if (
        fundingGoal > 0 &&
        currentFunding >= fundingGoal &&
        (productData.currentFunding || 0) < fundingGoal
      ) {
        // Product just became fully funded - send notifications to all stakeholders

        // 1. Send notification to designer that their product is fully funded
        if (designerId) {
          await notificationService.createNotification(
            designerId,
            "funding_complete",
            "Product Fully Funded! 🎉",
            `Congratulations! Your product ${
              productData.name || "product"
            } has reached its funding goal of $${fundingGoal}. You can now proceed with manufacturing.`,
            `/product/${productId}`
          );
        }

        // 2. Send notifications to all investors who contributed to this product
        if (
          Array.isArray(productData.funders) &&
          productData.funders.length > 0
        ) {
          for (const funderId of productData.funders) {
            if (funderId !== userId) {
              // Skip the current investor as they'll get a special message
              await notificationService.createNotification(
                funderId,
                "funding_complete",
                "Product Fully Funded! 🎉",
                `A product you invested in (${
                  productData.name || "product"
                }) has reached its funding goal of $${fundingGoal} and will now move to manufacturing.`,
                `/product/${productId}`
              );
            }
          }
        }

        // 3. Special notification for the investor who just completed the funding
        await notificationService.createNotification(
          userId,
          "funding_complete",
          "Product Fully Funded! 🎉",
          `Your investment has fully funded ${
            productData.name || "product"
          }! The product has reached its goal of $${fundingGoal} and will now move to manufacturing.`,
          `/product/${productId}`
        );

        // 4. If there's a pre-selected manufacturer, notify them as well
        try {
          const designerSettingsRef = doc(db, "designerSettings", designerId);
          const designerSettingsDoc = await getDoc(designerSettingsRef);

          if (designerSettingsDoc.exists()) {
            const designerSettings = designerSettingsDoc.data();
            const manufacturerSettings =
              designerSettings.manufacturerSettings || {};
            const preSelectedManufacturerId = manufacturerSettings[productId];

            if (preSelectedManufacturerId) {
              await notificationService.createNotification(
                preSelectedManufacturerId,
                "funding_complete",
                "Product Ready for Manufacturing",
                `A product assigned to you (${
                  productData.name || "product"
                }) has been fully funded with $${fundingGoal} and is now ready for manufacturing.`,
                `/product/${productId}`
              );
            }
          }
        } catch (err) {
          console.error(
            "Error sending notification to pre-selected manufacturer:",
            err
          );
          // Continue execution even if this notification fails
        }

        // Check for auto transfer settings
        setTimeout(async () => {
          try {
            await this.checkAndAutoTransferFunds(productId);
          } catch (error) {
            console.error("Error in auto-transfer process:", error);
          }
        }, 1000); // Slight delay to ensure the batch commit is fully processed first
      } else if (fundingGoal > 0 && currentFunding >= fundingGoal) {
        // Product was already fully funded before this investment
        // Check for auto transfer settings
        setTimeout(async () => {
          try {
            await this.checkAndAutoTransferFunds(productId);
          } catch (error) {
            console.error("Error in auto-transfer process:", error);
          }
        }, 1000); // Slight delay to ensure the batch commit is fully processed first
      }

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
   * @param {string} orderId - The order ID reference
   * @returns {Promise<Object>} Result with success status and commission amount
   */
  async processBusinessCommission(
    saleAmount,
    manufacturingCost,
    quantity = 1,
    productId,
    productName,
    orderId
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
      } // Get settings
      const settings = settingsDoc.data();
      // Ensure commission rate is a number
      const commissionRate = parseFloat(settings.commissionRate) || 2.0; // Default to 2% if not specified or NaN      // Calculate commission (percentage of sale amount, not profit)
      // This ensures the commission is properly calculated as per business requirements

      // To ensure exact decimal calculations, convert to cents first (integer math)
      const saleAmountCents = Math.floor(saleAmount * 100);
      const commissionCents = Math.floor(
        (saleAmountCents * commissionRate) / 100
      );

      // Convert back to dollars
      const roundedCommission = commissionCents / 100;

      // Update business wallet balance
      const businessWalletRef = doc(db, "wallets", "business");
      const businessWalletDoc = await getDoc(businessWalletRef);

      if (businessWalletDoc.exists()) {
        // Update existing wallet
        await updateDoc(businessWalletRef, {
          balance: increment(roundedCommission),
          updatedAt: serverTimestamp(),
        });
      } else {
        // Create business wallet if it doesn't exist
        await setDoc(businessWalletRef, {
          balance: roundedCommission,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } // Record transaction for business account
      await this.recordTransaction("business", {
        amount: roundedCommission,
        type: "commission",
        description: `Commission from sale of ${productName || "product"}`,
        productId,
        orderId, // Add orderId reference for refund tracking
        commissionRate: settings.commissionRate,
        saleAmount: Math.abs(saleAmount), // Ensure sale amount is always positive for reporting
        status: "completed",
      });

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
   */ async distributeInvestorRevenue(
    productId,
    saleAmount,
    manufacturingCost,
    quantity = 1,
    orderId
  ) {
    try {
      // Add detailed logging to identify which parameter is invalid
      console.log("Revenue distribution parameters:", {
        productId,
        saleAmount,
        manufacturingCost,
        quantity,
        orderId,
      });

      // Ensure numeric values are actually numbers, not strings
      let validatedSaleAmount = saleAmount;
      if (typeof saleAmount === "string") {
        validatedSaleAmount = parseFloat(saleAmount);
      }

      let validatedManufacturingCost = manufacturingCost;
      if (typeof manufacturingCost === "string") {
        validatedManufacturingCost = parseFloat(manufacturingCost);
      }

      let validatedQuantity = quantity;
      if (typeof quantity === "string") {
        validatedQuantity = parseInt(quantity, 10);
      }

      // Validate parameters before calling the cloud function
      if (!productId || typeof productId !== "string") {
        console.error("Invalid productId:", productId);
        return {
          success: false,
          error: "Invalid productId",
        };
      }

      if (
        !validatedSaleAmount ||
        isNaN(validatedSaleAmount) ||
        validatedSaleAmount <= 0
      ) {
        console.error("Invalid saleAmount:", saleAmount);
        return {
          success: false,
          error: "Invalid saleAmount",
        };
      }

      if (
        validatedManufacturingCost === undefined ||
        validatedManufacturingCost === null ||
        isNaN(validatedManufacturingCost)
      ) {
        console.error("Invalid manufacturingCost:", manufacturingCost);
        return {
          success: false,
          error: "Invalid manufacturingCost",
        };
      }

      if (
        !validatedQuantity ||
        isNaN(validatedQuantity) ||
        validatedQuantity <= 0
      ) {
        console.error("Invalid quantity:", quantity);
        return {
          success: false,
          error: "Invalid quantity",
        };
      }

      if (!orderId || typeof orderId !== "string") {
        console.error("Invalid orderId:", orderId);
        return {
          success: false,
          error: "Invalid orderId",
        };
      }

      // Use Firebase Cloud Function to distribute revenue
      const functions = getFunctions();
      const distributeRevenue = httpsCallable(
        functions,
        "distributeInvestorRevenue"
      ); // Use safe logging to prevent circular references
      console.log(
        "Calling distributeInvestorRevenue with params:",
        JSON.stringify({
          productId,
          saleAmount: validatedSaleAmount,
          manufacturingCost: validatedManufacturingCost,
          quantity: validatedQuantity,
          orderId,
        })
      );

      // Create a clean parameter object to avoid any circular references
      const cleanParams = {
        productId: String(productId),
        saleAmount: Number(validatedSaleAmount),
        manufacturingCost: Number(validatedManufacturingCost),
        quantity: Number(validatedQuantity),
        orderId: String(orderId),
      };

      const result = await distributeRevenue(cleanParams); // Use safe logging to prevent circular references and extract only the data we need
      try {
        const safeResult = {
          distributedAmount: result.data.distributedAmount || 0,
          investorCount: result.data.investorCount || 0,
          success: result.data.success || false,
          message: result.data.message || "",
        };

        console.log(
          "distributeInvestorRevenue result:",
          JSON.stringify(safeResult)
        );

        return {
          success: true,
          data: safeResult,
        };
      } catch (resultError) {
        console.error("Error processing result:", resultError);
        return {
          success: true, // Still consider it a success if we got a result but couldn't parse it
          data: {
            distributedAmount: 0,
            message: "Could not process distribution result",
          },
        };
      }
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
   * @param {number} saleAmount - The total sale amount (including shipping)
   * @param {number} manufacturingCost - The manufacturing cost per unit
   * @param {number} quantity - The quantity of items sold
   * @param {string} orderId - The order ID
   * @param {number} shippingCost - The shipping cost (default 0)
   * @returns {Promise<Object>} Result with status and processing details
   */ async processProductSale(
    productId,
    productName,
    saleAmount,
    manufacturingCost,
    quantity = 1,
    orderId,
    shippingCost = 0,
    taxAmount = 0
  ) {
    try {
      // Log all parameters for debugging
      console.log("processProductSale parameters:", {
        productId,
        productName,
        saleAmount,
        manufacturingCost,
        quantity,
        orderId,
        shippingCost,
        taxAmount,
      });

      // Ensure numeric values are actually numbers
      const validatedSaleAmount =
        typeof saleAmount === "string" ? parseFloat(saleAmount) : saleAmount;
      const validatedManufacturingCost =
        typeof manufacturingCost === "string"
          ? parseFloat(manufacturingCost)
          : manufacturingCost;
      const validatedQuantity =
        typeof quantity === "string" ? parseInt(quantity, 10) : quantity;
      const validatedShippingCost =
        typeof shippingCost === "string"
          ? parseFloat(shippingCost)
          : shippingCost;
      const validatedTaxAmount =
        typeof taxAmount === "string" ? parseFloat(taxAmount) : taxAmount || 0;

      // Validate all required parameters
      if (!productId || typeof productId !== "string") {
        console.error("Invalid productId:", productId);
        return {
          success: false,
          error: "Invalid product ID",
        };
      }

      if (
        !validatedSaleAmount ||
        isNaN(validatedSaleAmount) ||
        validatedSaleAmount <= 0
      ) {
        console.error("Invalid saleAmount:", saleAmount);
        return {
          success: false,
          error: "Invalid sale amount",
        };
      }

      if (isNaN(validatedManufacturingCost)) {
        console.error("Invalid manufacturingCost:", manufacturingCost);
        return {
          success: false,
          error: "Invalid manufacturing cost",
        };
      }

      if (
        !validatedQuantity ||
        isNaN(validatedQuantity) ||
        validatedQuantity <= 0
      ) {
        console.error("Invalid quantity:", quantity);
        return {
          success: false,
          error: "Invalid quantity",
        };
      }

      if (!orderId || typeof orderId !== "string") {
        console.error("Invalid orderId:", orderId);
        return {
          success: false,
          error: "Invalid order ID",
        };
      }

      // Fetch the product to get the designer ID
      const productRef = doc(db, "products", productId);
      const productDoc = await getDoc(productRef);

      if (!productDoc.exists()) {
        return {
          success: false,
          error: "Product not found",
        };
      }

      const productData = productDoc.data();
      const designerId = productData.designerId;
      const isDirectSell = productData.isDirectSell || false;

      if (!designerId) {
        return {
          success: false,
          error: "Product has no designer ID",
        };
      }

      // The validatedSaleAmount already represents the subtotal (excluding shipping and tax)
      // so we use it directly for commission/investor calculations
      const productSaleAmount = validatedSaleAmount;

      // First, process business commission on the product subtotal only (not shipping or tax)
      // Always process commission for all products, including direct sell products
      const commissionResult = await this.processBusinessCommission(
        productSaleAmount,
        validatedManufacturingCost,
        validatedQuantity,
        productId,
        productName,
        orderId
      );

      // Get commission amount (default to 0 if there was an error)
      const commissionAmount = commissionResult.success
        ? commissionResult.commissionAmount || 0
        : 0;

      // Next, distribute revenue to investors (exclude shipping and tax from this calculation)
      // Only for crowdfunded products (not direct sell)
      let distributionResult = {
        success: true,
        data: { distributedAmount: 0 },
      };
      if (!isDirectSell) {
        distributionResult = await this.distributeInvestorRevenue(
          productId,
          productSaleAmount,
          validatedManufacturingCost,
          validatedQuantity,
          orderId
        );
      }

      // Get total distributed to investors (default to 0 if there was an error)
      const investorDistribution = distributionResult.success
        ? distributionResult.data?.distributedAmount || 0
        : 0; // Calculate designer's share: product sale amount minus commission minus investor distribution
      // (shipping and tax will be handled separately)
      // We need to ensure exact decimal calculation to avoid floating point issues
      // Convert to cents (integers), do the calculation, then convert back to dollars
      const saleAmountCents = Math.floor(productSaleAmount * 100);
      const commissionAmountCents = Math.floor(commissionAmount * 100);
      const investorDistributionCents = Math.floor(investorDistribution * 100);
      const designerShareCents =
        saleAmountCents - commissionAmountCents - investorDistributionCents;
      const designerShare = designerShareCents / 100;

      // Process payments to the designer
      let designerPaymentResult = null;
      let shippingPaymentResult = null;
      let taxPaymentResult = null;

      // Process base payment if there's anything to pay
      if (designerShare > 0) {
        designerPaymentResult = await this.payDesigner(
          designerId,
          designerShare,
          productId,
          productName,
          orderId
        );
      }

      // Process shipping payment as a separate transaction if applicable
      if (validatedShippingCost > 0) {
        shippingPaymentResult = await this.payDesignerShipping(
          designerId,
          validatedShippingCost,
          productId,
          productName,
          orderId
        );
      }

      // Process tax payment as a separate transaction if applicable
      if (validatedTaxAmount > 0) {
        taxPaymentResult = await this.payDesignerTax(
          designerId,
          validatedTaxAmount,
          productId,
          productName,
          orderId
        );
      }

      // Create clean result objects without circular references
      const safeCommissionResult = commissionResult.success
        ? {
            success: commissionResult.success,
            commissionAmount: commissionResult.commissionAmount || 0,
            commissionRate: commissionResult.commissionRate,
          }
        : null;

      const safeDistributionResult = distributionResult.success
        ? {
            distributedAmount: distributionResult.data?.distributedAmount || 0,
            investorCount: distributionResult.data?.investorCount || 0,
            message: distributionResult.data?.message || "",
          }
        : null;

      const safeDesignerResult = designerPaymentResult
        ? {
            success: designerPaymentResult.success,
            amount: designerPaymentResult.amount || 0,
          }
        : null;

      const safeShippingResult = shippingPaymentResult
        ? {
            success: shippingPaymentResult.success,
            amount: shippingPaymentResult.amount || 0,
          }
        : null;

      const safeTaxResult = taxPaymentResult
        ? {
            success: taxPaymentResult.success,
            amount: taxPaymentResult.amount || 0,
          }
        : null;

      return {
        success: true,
        commissionResult: safeCommissionResult,
        distributionResult: safeDistributionResult,
        designerPaymentResult: safeDesignerResult,
        shippingPaymentResult: safeShippingResult,
        taxPaymentResult: safeTaxResult,
        message: "Sale processed successfully",
        isDirectSell: isDirectSell,
      };
    } catch (error) {
      console.error("Error processing product sale:", error);
      return {
        success: false,
        error: error.message || "Failed to process product sale",
      };
    }
  }

  /**
   * Pay a designer for a product sale
   * @param {string} designerId - The ID of the designer
   * @param {number} amount - The amount to pay
   * @param {string} productId - The product ID
   * @param {string} productName - The product name
   * @param {string} orderId - The order ID
   * @returns {Promise<Object>} Result with success status
   */ async payDesigner(designerId, amount, productId, productName, orderId) {
    try {
      // Validate the amount
      if (amount <= 0) {
        return {
          success: false,
          error: "Payment amount must be greater than 0",
        };
      }

      // To avoid floating point errors, convert to cents (integer math) then back to dollars
      // This ensures we get exact amounts without weird fractions
      const amountCents = Math.floor(amount * 100);
      const roundedAmount = amountCents / 100;

      // Get designer's wallet
      const walletRef = doc(db, "wallets", designerId);
      const walletDoc = await getDoc(walletRef);

      // Create batch for transaction
      const batch = writeBatch(db);

      if (walletDoc.exists()) {
        // Update existing wallet
        batch.update(walletRef, {
          balance: increment(roundedAmount),
          updatedAt: serverTimestamp(),
        });
      } else {
        // Create wallet if it doesn't exist
        batch.set(walletRef, {
          balance: roundedAmount,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      // Record payment transaction
      await this.recordTransaction(designerId, {
        amount: roundedAmount,
        type: "sales_payment",
        description: `Payment for sale of ${productName || "product"}`,
        productId,
        orderId,
        status: "completed",
      });

      // Commit the batch
      await batch.commit();

      // Send notification to designer about the payment
      const notificationService = await import("./notificationService").then(
        (module) => module.default
      );

      await notificationService.createNotification(
        designerId,
        "payment",
        "Product Sale Payment",
        `You received $${roundedAmount.toFixed(2)} from the sale of ${
          productName || "your product"
        }.`,
        `/orders`
      );

      return {
        success: true,
        amount: roundedAmount,
        message: `Successfully paid designer $${roundedAmount.toFixed(
          2
        )} for product sale`,
      };
    } catch (error) {
      console.error("Error paying designer:", error);
      return {
        success: false,
        error: error.message || "Failed to process designer payment",
      };
    }
  }

  /**
   * Pay a designer for shipping costs
   * @param {string} designerId - The ID of the designer
   * @param {number} amount - The shipping amount to pay
   * @param {string} productId - The product ID
   * @param {string} productName - The product name
   * @param {string} orderId - The order ID
   * @returns {Promise<Object>} Result with success status
   */ async payDesignerShipping(
    designerId,
    amount,
    productId,
    productName,
    orderId
  ) {
    try {
      // Validate the amount
      if (amount <= 0) {
        return {
          success: false,
          error: "Shipping payment amount must be greater than 0",
        };
      }

      // To avoid floating point errors, convert to cents (integer math) then back to dollars
      // This ensures we get exact amounts without weird fractions
      const amountCents = Math.floor(amount * 100);
      const roundedAmount = amountCents / 100;

      // Get designer's wallet
      const walletRef = doc(db, "wallets", designerId);
      const walletDoc = await getDoc(walletRef);

      // Create batch for transaction
      const batch = writeBatch(db);

      if (walletDoc.exists()) {
        // Update existing wallet
        batch.update(walletRef, {
          balance: increment(roundedAmount),
          updatedAt: serverTimestamp(),
        });
      } else {
        // Create wallet if it doesn't exist
        batch.set(walletRef, {
          balance: roundedAmount,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } // Record payment transaction specifically for shipping
      // Check if this is a consolidated shipping payment
      const description =
        productId === "consolidated"
          ? productName // For consolidated payments, use the provided name (e.g. "Order Shipping")
          : `Shipping payment for ${productName || "product"}`; // For individual product shipping

      await this.recordTransaction(designerId, {
        amount: roundedAmount,
        type: "shipping_payment",
        description,
        productId,
        orderId,
        status: "completed",
      });

      // Commit the batch
      await batch.commit();

      // Send notification to designer about the shipping payment
      const notificationService = await import("./notificationService").then(
        (module) => module.default
      ); // Check if this is a consolidated shipping payment for better notification message
      const notificationMessage =
        productId === "consolidated"
          ? `You received $${roundedAmount.toFixed(
              2
            )} for shipping costs (Order #${orderId.slice(-6)}).`
          : `You received $${roundedAmount.toFixed(2)} for shipping of ${
              productName || "your product"
            }.`;

      await notificationService.createNotification(
        designerId,
        "payment",
        "Shipping Payment",
        notificationMessage,
        `/orders`
      );

      return {
        success: true,
        amount: roundedAmount,
        message: `Successfully paid designer $${roundedAmount.toFixed(
          2
        )} for shipping payment`,
      };
    } catch (error) {
      console.error("Error paying designer for shipping:", error);
      return {
        success: false,
        error: error.message || "Failed to process shipping payment",
      };
    }
  }

  /**
   * Pay a designer for tax collected
   * @param {string} designerId - The ID of the designer
   * @param {number} amount - The tax amount to pay
   * @param {string} productId - The product ID
   * @param {string} productName - The product name
   * @param {string} orderId - The order ID
   * @returns {Promise<Object>} Result with success status
   */ async payDesignerTax(
    designerId,
    amount,
    productId,
    productName,
    orderId
  ) {
    try {
      // Validate the amount
      if (amount <= 0) {
        return {
          success: false,
          error: "Tax payment amount must be greater than 0",
        };
      }

      // To avoid floating point errors, convert to cents (integer math) then back to dollars
      // This ensures we get exact amounts without weird fractions
      const amountCents = Math.floor(amount * 100);
      const roundedAmount = amountCents / 100;

      // Get designer's wallet
      const walletRef = doc(db, "wallets", designerId);
      const walletDoc = await getDoc(walletRef);

      // Create batch for transaction
      const batch = writeBatch(db);

      if (walletDoc.exists()) {
        // Update existing wallet
        batch.update(walletRef, {
          balance: increment(roundedAmount),
          updatedAt: serverTimestamp(),
        });
      } else {
        // Create wallet if it doesn't exist
        batch.set(walletRef, {
          balance: roundedAmount,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } // Record payment transaction specifically for tax
      // Check if this is a consolidated tax payment
      const description =
        productId === "consolidated"
          ? productName // For consolidated payments, use the provided name (e.g. "Order Tax")
          : `Tax payment for ${productName || "product"}`; // For individual product tax

      await this.recordTransaction(designerId, {
        amount: roundedAmount,
        type: "tax_payment",
        description,
        productId,
        orderId,
        status: "completed",
      });

      // Commit the batch
      await batch.commit();

      // Send notification to designer about the tax payment
      const notificationService = await import("./notificationService").then(
        (module) => module.default
      ); // Check if this is a consolidated tax payment for better notification message
      const notificationMessage =
        productId === "consolidated"
          ? `You received $${roundedAmount.toFixed(
              2
            )} for tax collected (Order #${orderId.slice(-6)}).`
          : `You received $${roundedAmount.toFixed(2)} for tax on ${
              productName || "your product"
            }.`;

      await notificationService.createNotification(
        designerId,
        "payment",
        "Tax Payment",
        notificationMessage,
        `/orders`
      );

      return {
        success: true,
        amount: roundedAmount,
        message: `Successfully paid designer $${roundedAmount.toFixed(
          2
        )} for tax payment`,
      };
    } catch (error) {
      console.error("Error paying designer for tax:", error);
      return {
        success: false,
        error: error.message || "Failed to process tax payment",
      };
    }
  }

  /**
   * Transfer product funds to manufacturer
   * @param {string} designerId - Designer's user ID (must be the product owner)
   * @param {string} productId - Product ID
   * @param {string} manufacturerEmail - Verified manufacturer's email
   * @param {string} note - Optional note for the transfer
   * @returns {Promise<Object>} Result with success status
   */
  async transferProductFundsToManufacturer(
    designerId,
    productId,
    manufacturerEmail,
    note = ""
  ) {
    try {
      // 1. Verify the product exists and is fully funded
      const productRef = doc(db, "products", productId);
      const productDoc = await getDoc(productRef);

      if (!productDoc.exists()) {
        return {
          success: false,
          error: "Product not found",
        };
      }

      const productData = productDoc.data();

      // 2. Verify the designer is the product owner
      if (productData.designerId !== designerId) {
        return {
          success: false,
          error: "Only the product designer can authorize fund transfers",
        };
      }

      // 3. Check if product is fully funded
      const currentFunding = productData.currentFunding || 0;
      const fundingGoal = productData.fundingGoal || 0;

      if (currentFunding < fundingGoal) {
        return {
          success: false,
          error:
            "Product must be fully funded before transferring to manufacturer",
        };
      }

      // 4. Check if the business account holds the funds
      const businessHeldFunds = productData.businessHeldFunds || 0;
      if (businessHeldFunds <= 0) {
        return {
          success: false,
          error: "No funds available for transfer",
        };
      }

      // 5. Find manufacturer by email
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("email", "==", manufacturerEmail));
      const manufacturerSnapshot = await getDocs(q);

      if (manufacturerSnapshot.empty) {
        return {
          success: false,
          error: "Manufacturer not found",
        };
      }

      const manufacturerDoc = manufacturerSnapshot.docs[0];
      const manufacturerId = manufacturerDoc.id;
      const manufacturerData = manufacturerDoc.data();

      // 6. Verify manufacturer has manufacturer role
      const manufacturerRoles = Array.isArray(manufacturerData.roles)
        ? manufacturerData.roles
        : manufacturerData.role
        ? [manufacturerData.role]
        : [];

      if (!manufacturerRoles.includes("manufacturer")) {
        return {
          success: false,
          error: "Selected recipient is not a verified manufacturer",
        };
      }

      // 7. Check business wallet balance
      const businessWalletRef = doc(db, "wallets", "business");
      const businessWalletDoc = await getDoc(businessWalletRef);

      if (
        !businessWalletDoc.exists() ||
        businessWalletDoc.data().balance < businessHeldFunds
      ) {
        return {
          success: false,
          error: "Business account has insufficient funds for this transfer",
        };
      }

      // 8. Create batch for the transfer
      const batch = writeBatch(db);

      // 9. Deduct from business wallet
      batch.update(businessWalletRef, {
        balance: increment(-businessHeldFunds),
        updatedAt: serverTimestamp(),
      });

      // 10. Update manufacturer's wallet
      const manufacturerWalletRef = doc(db, "wallets", manufacturerId);
      const manufacturerWalletDoc = await getDoc(manufacturerWalletRef);

      if (manufacturerWalletDoc.exists()) {
        // Update existing wallet
        batch.update(manufacturerWalletRef, {
          balance: increment(businessHeldFunds),
          updatedAt: serverTimestamp(),
        });
      } else {
        // Create new wallet if needed
        batch.set(manufacturerWalletRef, {
          balance: businessHeldFunds,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      // 11. Update product record to mark funds as transferred
      batch.update(productRef, {
        businessHeldFunds: 0,
        manufacturerFunded: true,
        manufacturerFundedAt: serverTimestamp(),
        manufacturerId: manufacturerId,
        manufacturerEmail: manufacturerEmail,
        manufacturerTransferAmount: businessHeldFunds,
      });

      // 12. Record transaction for the business account (outgoing)
      await this.recordTransaction("business", {
        amount: -businessHeldFunds,
        type: "manufacturer_transfer",
        description: `Funds transfer to manufacturer for ${
          productData.name || "product"
        }${note ? ": " + note : ""}`,
        productId,
        designerId,
        manufacturerId,
        status: "completed",
      });

      // 13. Record transaction for the manufacturer (incoming)
      await this.recordTransaction(manufacturerId, {
        amount: businessHeldFunds,
        type: "manufacturer_funding",
        description: `Funds received for manufacturing ${
          productData.name || "product"
        }${note ? ": " + note : ""}`,
        productId,
        designerId,
        status: "completed",
      });

      // 14. Commit all changes
      await batch.commit();

      // 15. Send notifications to all parties
      const notificationService = await import("./notificationService").then(
        (module) => module.default
      );

      // Notify the manufacturer
      await notificationService.createNotification(
        manufacturerId,
        "manufacturer_funding",
        "Manufacturing Funds Received",
        `You have received $${businessHeldFunds.toFixed(2)} to manufacture ${
          productData.name || "product"
        }.`,
        `/manufacturer/dashboard`
      );

      // Notify the designer
      await notificationService.createNotification(
        designerId,
        "funds_transferred",
        "Funds Transferred to Manufacturer",
        `$${businessHeldFunds.toFixed(2)} has been transferred to ${
          manufacturerData.displayName || manufacturerEmail
        } for manufacturing ${productData.name || "product"}.`,
        `/product/${productId}`
      );

      // Notify all investors about the manufacturing progress
      if (
        Array.isArray(productData.funders) &&
        productData.funders.length > 0
      ) {
        for (const investorId of productData.funders) {
          await notificationService.createNotification(
            investorId,
            "manufacturing_started",
            "Manufacturing Started",
            `A product you invested in (${productData.name || "product"}) 
            is now moving to manufacturing with ${
              manufacturerData.displayName || "the manufacturer"
            }.`,
            `/product/${productId}`
          );
        }
      }

      return {
        success: true,
        amount: businessHeldFunds,
        message: `Successfully transferred $${businessHeldFunds.toFixed(
          2
        )} to manufacturer for ${productData.name || "product"}`,
      };
    } catch (error) {
      console.error("Error transferring funds to manufacturer:", error);
      return {
        success: false,
        error: error.message || "Failed to transfer funds to manufacturer",
      };
    }
  }
  /**
   * Check and auto-transfer funds to pre-selected manufacturer when a product is fully funded
   * @param {string} productId - Product ID to check
   * @returns {Promise<Object>} Result of auto-transfer
   */
  async checkAndAutoTransferFunds(productId) {
    console.log(
      `[WalletService] Checking auto-transfer for product ${productId}`
    );

    try {
      // 1. Get the product data
      const productRef = doc(db, "products", productId);
      const productDoc = await getDoc(productRef);

      if (!productDoc.exists()) {
        console.log(`[WalletService] Product ${productId} not found`);
        return {
          success: false,
          error: "Product not found",
        };
      }

      const productData = productDoc.data();
      const designerId = productData.designerId;

      if (!designerId) {
        console.log(`[WalletService] Product ${productId} has no designer ID`);
        return {
          success: false,
          error: "Product has no designer ID",
        };
      }

      // 2. Check if product is fully funded and has business held funds
      const currentFunding = productData.currentFunding || 0;
      const fundingGoal = productData.fundingGoal || 0;
      const businessHeldFunds = productData.businessHeldFunds || 0;

      console.log(`[WalletService] Product funding status:`, {
        productId,
        currentFunding,
        fundingGoal,
        businessHeldFunds,
        isFullyFunded: currentFunding >= fundingGoal,
      });

      if (currentFunding < fundingGoal || businessHeldFunds <= 0) {
        console.log(
          `[WalletService] Product ${productId} is not fully funded or has no business-held funds`
        );
        return {
          success: false,
          error: "Product is not fully funded or has no business-held funds",
        };
      }

      // 3. Check designer settings for auto-transfer configuration
      const designerSettingsRef = doc(db, "designerSettings", designerId);
      const designerSettingsDoc = await getDoc(designerSettingsRef);

      if (!designerSettingsDoc.exists()) {
        console.log(
          `[WalletService] Designer settings not found for ${designerId}`
        );
        return {
          success: false,
          error: "Designer settings not found",
        };
      }

      const designerSettings = designerSettingsDoc.data();
      console.log(`[WalletService] Designer settings found:`, {
        designerId,
        autoTransferFunds: designerSettings.autoTransferFunds,
        hasManufacturerSettings: !!designerSettings.manufacturerSettings,
      });

      // 4. Check if auto-transfer is enabled and there's a pre-selected manufacturer
      const manufacturerSettings = designerSettings.manufacturerSettings || {};
      const autoTransferEnabled = designerSettings.autoTransferFunds || false;
      const preSelectedManufacturerId = manufacturerSettings[productId];

      console.log(`[WalletService] Auto-transfer check:`, {
        autoTransferEnabled,
        preSelectedManufacturerId,
        productId,
      });

      if (!autoTransferEnabled || !preSelectedManufacturerId) {
        console.log(
          `[WalletService] Auto-transfer not enabled or no pre-selected manufacturer`
        );
        return {
          success: false,
          error: "Auto-transfer not enabled or no pre-selected manufacturer",
        };
      }

      // 5. Get manufacturer email
      const manufacturerRef = doc(db, "users", preSelectedManufacturerId);
      const manufacturerDoc = await getDoc(manufacturerRef);

      if (!manufacturerDoc.exists()) {
        console.log(
          `[WalletService] Pre-selected manufacturer ${preSelectedManufacturerId} not found`
        );
        return {
          success: false,
          error: "Pre-selected manufacturer not found",
        };
      }

      const manufacturerEmail = manufacturerDoc.data().email;
      console.log(
        `[WalletService] Found manufacturer email: ${manufacturerEmail}`
      );

      // 6. Transfer funds to manufacturer
      console.log(
        `[WalletService] Initiating fund transfer to manufacturer for product ${productId}`
      );
      const result = await this.transferProductFundsToManufacturer(
        designerId,
        productId,
        manufacturerEmail,
        "Auto-transferred funds for manufacturing"
      );

      console.log(`[WalletService] Auto-transfer result:`, result);
      return result;
    } catch (error) {
      console.error("Error in auto-transfer funds process:", error);
      return {
        success: false,
        error: error.message || "Failed to auto-transfer funds",
      };
    }
  }
}

export default new WalletService();
