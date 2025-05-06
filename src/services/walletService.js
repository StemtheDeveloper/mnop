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

      // Use a simple query without ordering to avoid index issues
      const q = query(
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
    } catch (error) {
      console.error("Error getting transaction history:", error);
      return []; // Return an empty array on error instead of retrying
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
      const userTransactionRef = doc(collection(db, "transactions"));
      batch.set(userTransactionRef, {
        userId,
        amount: -amount,
        type: "investment",
        description: `Investment in ${productData.name || "product"}`,
        productId,
        createdAt: serverTimestamp(),
        status: "completed",
      });

      // 5.2 Record the deposit to the business account
      const businessTransactionRef = doc(collection(db, "transactions"));
      batch.set(businessTransactionRef, {
        userId: "business",
        amount: amount,
        type: "funding_hold",
        description: `Holding funds for ${productData.name || "product"}`,
        productId,
        createdAt: serverTimestamp(),
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
      // Ensure commission rate is a number
      const commissionRate = parseFloat(settings.commissionRate) || 2.0; // Default to 2% if not specified or NaN

      // Calculate commission (percentage of sale amount, not profit)
      // This ensures the commission is properly calculated as per business requirements
      const commission = saleAmount * (commissionRate / 100);
      const roundedCommission = Math.round(commission * 100) / 100; // Round to 2 decimal places

      if (roundedCommission <= 0) {
        return {
          success: true,
          commissionAmount: 0,
          message: "No commission taken (zero or negative calculation)",
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
   * @param {number} saleAmount - The total sale amount (including shipping)
   * @param {number} manufacturingCost - The manufacturing cost per unit
   * @param {number} quantity - The quantity of items sold
   * @param {string} orderId - The order ID
   * @param {number} shippingCost - The shipping cost (default 0)
   * @returns {Promise<Object>} Result with status and processing details
   */
  async processProductSale(
    productId,
    productName,
    saleAmount,
    manufacturingCost,
    quantity = 1,
    orderId,
    shippingCost = 0
  ) {
    try {
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

      // Calculate the product sale amount excluding shipping for commission/investor calculations
      const productSaleAmount = saleAmount - shippingCost;

      // First, process business commission on the product amount only (not shipping)
      // Always process commission for all products, including direct sell products
      const commissionResult = await this.processBusinessCommission(
        productSaleAmount,
        manufacturingCost,
        quantity,
        productId,
        productName
      );

      // Get commission amount (default to 0 if there was an error)
      const commissionAmount = commissionResult.success
        ? commissionResult.commissionAmount || 0
        : 0;

      // Next, distribute revenue to investors (exclude shipping from this calculation)
      // Only for crowdfunded products (not direct sell)
      let distributionResult = {
        success: true,
        data: { distributedAmount: 0 },
      };
      if (!isDirectSell) {
        distributionResult = await this.distributeInvestorRevenue(
          productId,
          productSaleAmount,
          manufacturingCost,
          quantity,
          orderId
        );
      }

      // Get total distributed to investors (default to 0 if there was an error)
      const investorDistribution = distributionResult.success
        ? distributionResult.data?.distributedAmount || 0
        : 0;

      // Calculate designer's share: product sale amount minus commission minus investor distribution, plus shipping
      const designerShare =
        productSaleAmount -
        commissionAmount -
        investorDistribution +
        shippingCost;

      // Only process designer payment if there's anything to pay
      let designerPaymentResult = null;
      if (designerShare > 0) {
        designerPaymentResult = await this.payDesigner(
          designerId,
          designerShare,
          productId,
          productName,
          orderId
        );
      }

      return {
        success: true,
        commissionResult: commissionResult.success ? commissionResult : null,
        distributionResult: distributionResult.success
          ? distributionResult.data
          : null,
        designerPaymentResult: designerPaymentResult,
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
   */
  async payDesigner(designerId, amount, productId, productName, orderId) {
    try {
      // Validate the amount
      if (amount <= 0) {
        return {
          success: false,
          error: "Payment amount must be greater than 0",
        };
      }

      // Round to 2 decimal places for currency
      const roundedAmount = Math.round(amount * 100) / 100;

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
      const transactionRef = doc(collection(db, "transactions"));
      batch.set(transactionRef, {
        userId: designerId,
        amount: roundedAmount,
        type: "sales_payment",
        description: `Payment for sale of ${productName || "product"}`,
        productId,
        orderId,
        createdAt: serverTimestamp(),
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
          error: "Insufficient funds in business account",
        };
      }

      // 8. Begin transaction to transfer funds
      const batch = writeBatch(db);

      // 8.1 Update business wallet
      batch.update(businessWalletRef, {
        balance: increment(-businessHeldFunds),
        updatedAt: serverTimestamp(),
      });

      // 8.2 Update or create manufacturer wallet
      const manufacturerWalletRef = doc(db, "wallets", manufacturerId);
      const manufacturerWalletDoc = await getDoc(manufacturerWalletRef);

      if (manufacturerWalletDoc.exists()) {
        batch.update(manufacturerWalletRef, {
          balance: increment(businessHeldFunds),
          updatedAt: serverTimestamp(),
        });
      } else {
        batch.set(manufacturerWalletRef, {
          balance: businessHeldFunds,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      // 8.3 Update product status
      batch.update(productRef, {
        manufacturerId,
        manufacturerEmail,
        businessHeldFunds: 0, // Reset held funds to 0
        manufacturingStatus: "funded",
        fundsSentToManufacturer: true,
        manufacturingStartDate: serverTimestamp(),
      });

      // 8.4 Create transaction records
      // Business debit transaction
      const businessTransactionRef = doc(collection(db, "transactions"));
      batch.set(businessTransactionRef, {
        userId: "business",
        amount: -businessHeldFunds,
        type: "manufacturing_transfer",
        description: `Transferred funds to manufacturer for ${
          productData.name || "product"
        }`,
        productId,
        manufacturerId,
        designerId,
        createdAt: serverTimestamp(),
        status: "completed",
        note: note || "Manufacturing funds transfer",
      });

      // Manufacturer credit transaction
      const manufacturerTransactionRef = doc(collection(db, "transactions"));
      batch.set(manufacturerTransactionRef, {
        userId: manufacturerId,
        amount: businessHeldFunds,
        type: "manufacturing_funds",
        description: `Received manufacturing funds for ${
          productData.name || "product"
        }`,
        productId,
        designerId,
        createdAt: serverTimestamp(),
        status: "completed",
        note: note || "Manufacturing funds transfer",
      });

      // Commit all changes
      await batch.commit();

      // 9. Send notifications to relevant parties
      const notificationService = await import("./notificationService").then(
        (module) => module.default
      );

      // Notify the designer
      await notificationService.createNotification(
        designerId,
        "manufacturing",
        "Funds Transferred to Manufacturer",
        `$${businessHeldFunds.toFixed(
          2
        )} has been transferred to ${manufacturerEmail} for manufacturing ${
          productData.name || "product"
        }.`,
        `/product/${productId}`
      );

      // Notify the manufacturer
      await notificationService.createNotification(
        manufacturerId,
        "manufacturing",
        "Manufacturing Funds Received",
        `You've received $${businessHeldFunds.toFixed(2)} to manufacture ${
          productData.name || "product"
        }.`,
        `/product/${productId}`
      );

      // 10. Notify funders that manufacturing has begun
      if (
        Array.isArray(productData.funders) &&
        productData.funders.length > 0
      ) {
        for (const funderId of productData.funders) {
          if (funderId !== designerId) {
            // Don't notify the designer twice
            await notificationService.createNotification(
              funderId,
              "manufacturing",
              "Manufacturing Started",
              `Manufacturing has begun for ${
                productData.name || "product"
              } that you funded.`,
              `/product/${productId}`
            );
          }
        }
      }

      return {
        success: true,
        amount: businessHeldFunds,
        message: `Successfully transferred $${businessHeldFunds.toFixed(
          2
        )} to manufacturer ${manufacturerEmail}`,
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
   * Check and auto-transfer funds to pre-selected manufacturer if enabled
   * @param {string} productId - Product ID that just got funded
   * @returns {Promise<Object>} Result with success status
   */
  async checkAndAutoTransferFunds(productId) {
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
      const designerId = productData.designerId;

      if (!designerId) {
        return {
          success: false,
          error: "Product has no designer ID",
        };
      }

      // 2. Check if product is fully funded
      const currentFunding = productData.currentFunding || 0;
      const fundingGoal = productData.fundingGoal || 0;

      if (currentFunding < fundingGoal) {
        return {
          success: false,
          error: "Product is not fully funded yet",
        };
      }

      // 3. Check if funds were already sent to manufacturer
      if (productData.fundsSentToManufacturer || productData.manufacturerId) {
        return {
          success: false,
          error: "Funds have already been transferred to a manufacturer",
        };
      }

      // 4. Check designer settings for auto-transfer preference
      const designerSettingsRef = doc(db, "designerSettings", designerId);
      const designerSettingsDoc = await getDoc(designerSettingsRef);

      if (!designerSettingsDoc.exists()) {
        return {
          success: false,
          error: "No designer settings found",
        };
      }

      const designerSettings = designerSettingsDoc.data();

      // Check if auto-transfer is enabled and if there's a pre-selected manufacturer
      if (!designerSettings.autoTransferFunds) {
        return {
          success: false,
          error: "Auto-transfer is not enabled for this designer",
        };
      }

      // Check if there's a pre-selected manufacturer for this product
      const manufacturerSettings = designerSettings.manufacturerSettings || {};
      const preSelectedManufacturerId = manufacturerSettings[productId];

      if (!preSelectedManufacturerId) {
        return {
          success: false,
          error: "No pre-selected manufacturer found for this product",
        };
      }

      // 5. Get manufacturer email (required for transferProductFundsToManufacturer)
      const manufacturerRef = doc(db, "users", preSelectedManufacturerId);
      const manufacturerDoc = await getDoc(manufacturerRef);

      if (!manufacturerDoc.exists()) {
        return {
          success: false,
          error: "Pre-selected manufacturer not found",
        };
      }

      const manufacturerData = manufacturerDoc.data();
      const manufacturerEmail = manufacturerData.email;

      if (!manufacturerEmail) {
        return {
          success: false,
          error: "Manufacturer email not found",
        };
      }

      // 6. Transfer funds to the pre-selected manufacturer
      const transferResult = await this.transferProductFundsToManufacturer(
        designerId,
        productId,
        manufacturerEmail,
        "Auto-transferred funds for fully funded product"
      );

      // 7. If successful, update product with information
      if (transferResult.success) {
        await updateDoc(productRef, {
          autoTransferred: true,
          autoTransferredAt: serverTimestamp(),
        });

        // Send an additional notification to the designer about the auto-transfer
        const notificationService = await import("./notificationService").then(
          (module) => module.default
        );

        await notificationService.createNotification(
          designerId,
          "manufacturing",
          "Automatic Funds Transfer",
          `Your product ${
            productData.name || "product"
          } was fully funded and funds ($${transferResult.amount.toFixed(
            2
          )}) were automatically transferred to your pre-selected manufacturer.`,
          `/product/${productId}`
        );
      }

      return transferResult;
    } catch (error) {
      console.error("Error in auto-transfer process:", error);
      return {
        success: false,
        error: error.message || "Failed to auto-transfer funds to manufacturer",
      };
    }
  }
}

const walletService = new WalletService();
export default walletService;
