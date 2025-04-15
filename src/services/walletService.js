import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  increment,
  collection,
  addDoc,
  query,
  where,
  orderBy,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../config/firebase";

class WalletService {
  /**
   * Initialize or get a user's wallet
   * @param {string} userId - The user's ID
   * @returns {Promise<Object>} - The wallet data or error
   */
  async initializeWallet(userId) {
    try {
      // Check if wallet already exists
      const walletRef = doc(db, "users", userId);
      const userDoc = await getDoc(walletRef);

      if (userDoc.exists() && userDoc.data().wallet) {
        // Wallet already exists, return it
        return {
          success: true,
          data: userDoc.data().wallet,
        };
      }

      // Create new wallet with default values
      const newWallet = {
        balance: 1000, // Starting amount (1000 credits)
        lastUpdated: serverTimestamp(),
        transactions: [],
      };

      // Update the user document with the new wallet
      await updateDoc(walletRef, {
        wallet: newWallet,
        updatedAt: serverTimestamp(),
      });

      // Create first transaction
      await this.recordTransaction(userId, {
        type: "credit",
        amount: 1000,
        description: "Welcome bonus",
        status: "completed",
      });

      return {
        success: true,
        data: newWallet,
      };
    } catch (error) {
      console.error("Error initializing wallet:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get a user's wallet balance
   * @param {string} userId - The user's ID
   * @returns {Promise<Object>} - The wallet data or error
   */
  async getWalletBalance(userId) {
    try {
      const walletRef = doc(db, "users", userId);
      const userDoc = await getDoc(walletRef);

      if (!userDoc.exists() || !userDoc.data().wallet) {
        // Initialize wallet if it doesn't exist
        return await this.initializeWallet(userId);
      }

      return {
        success: true,
        data: userDoc.data().wallet,
      };
    } catch (error) {
      console.error("Error getting wallet balance:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Add credits to a user's wallet
   * @param {string} userId - The user's ID
   * @param {number} amount - The amount to add
   * @param {string} description - Description of the transaction
   * @returns {Promise<Object>} - The updated wallet data or error
   */
  async addCredits(userId, amount, description) {
    try {
      // Make sure amount is positive
      if (amount <= 0) {
        throw new Error("Amount must be greater than zero");
      }

      // Get wallet reference
      const walletRef = doc(db, "users", userId);
      const userDoc = await getDoc(walletRef);

      if (!userDoc.exists() || !userDoc.data().wallet) {
        // Initialize wallet if it doesn't exist
        await this.initializeWallet(userId);
      }

      // Update the wallet balance with the increment function
      await updateDoc(walletRef, {
        "wallet.balance": increment(amount),
        "wallet.lastUpdated": serverTimestamp(),
      });

      // Record the transaction
      await this.recordTransaction(userId, {
        type: "credit",
        amount,
        description,
        status: "completed",
      });

      // Get updated wallet
      const updatedDoc = await getDoc(walletRef);

      return {
        success: true,
        data: updatedDoc.data().wallet,
      };
    } catch (error) {
      console.error("Error adding credits:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Subtract credits from a user's wallet
   * @param {string} userId - The user's ID
   * @param {number} amount - The amount to subtract
   * @param {string} description - Description of the transaction
   * @returns {Promise<Object>} - The updated wallet data or error
   */
  async subtractCredits(userId, amount, description) {
    try {
      // Make sure amount is positive
      if (amount <= 0) {
        throw new Error("Amount must be greater than zero");
      }

      // Get wallet
      const {
        success,
        data: wallet,
        error,
      } = await this.getWalletBalance(userId);

      if (!success) {
        throw new Error(error || "Could not get wallet");
      }

      // Check if there are sufficient funds
      if (wallet.balance < amount) {
        return {
          success: false,
          error: "Insufficient funds in wallet",
        };
      }

      // Update the wallet balance with the increment function (negative amount)
      const walletRef = doc(db, "users", userId);
      await updateDoc(walletRef, {
        "wallet.balance": increment(-amount),
        "wallet.lastUpdated": serverTimestamp(),
      });

      // Record the transaction
      await this.recordTransaction(userId, {
        type: "debit",
        amount,
        description,
        status: "completed",
      });

      // Get updated wallet
      const updatedDoc = await getDoc(walletRef);

      return {
        success: true,
        data: updatedDoc.data().wallet,
      };
    } catch (error) {
      console.error("Error subtracting credits:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Transfer credits from one user to another
   * @param {string} fromUserId - The sender's user ID
   * @param {string} toUserId - The recipient's user ID
   * @param {number} amount - The amount to transfer
   * @param {string} description - Description of the transaction
   * @returns {Promise<Object>} - Result of the transfer operation
   */
  async transferCredits(fromUserId, toUserId, amount, description) {
    try {
      // Make sure amount is positive
      if (amount <= 0) {
        throw new Error("Amount must be greater than zero");
      }

      // Check if sender has sufficient funds
      const {
        success,
        data: senderWallet,
        error,
      } = await this.getWalletBalance(fromUserId);

      if (!success) {
        throw new Error(error || "Could not get sender's wallet");
      }

      if (senderWallet.balance < amount) {
        return {
          success: false,
          error: "Insufficient funds for transfer",
        };
      }

      // Subtract from sender
      const subtractResult = await this.subtractCredits(
        fromUserId,
        amount,
        `Transfer to user: ${description}`
      );

      if (!subtractResult.success) {
        return subtractResult;
      }

      // Add to recipient
      const addResult = await this.addCredits(
        toUserId,
        amount,
        `Transfer from user: ${description}`
      );

      if (!addResult.success) {
        // If adding to recipient fails, refund the sender
        await this.addCredits(fromUserId, amount, "Refund: Failed transfer");
        return addResult;
      }

      return {
        success: true,
        data: {
          from: subtractResult.data,
          to: addResult.data,
        },
      };
    } catch (error) {
      console.error("Error transferring credits:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Record a transaction in the transactions collection
   * @param {string} userId - The user's ID
   * @param {Object} transactionData - Transaction details
   * @returns {Promise<Object>} - The transaction record or error
   */
  async recordTransaction(userId, transactionData) {
    try {
      // Create transaction record
      const transaction = {
        userId,
        ...transactionData,
        createdAt: serverTimestamp(),
      };

      // Add to transactions collection
      const transactionsRef = collection(db, "transactions");
      const docRef = await addDoc(transactionsRef, transaction);

      return {
        success: true,
        data: {
          id: docRef.id,
          ...transaction,
        },
      };
    } catch (error) {
      console.error("Error recording transaction:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get transaction history for a user
   * @param {string} userId - The user's ID
   * @param {number} limit - Number of transactions to fetch (default: 20)
   * @returns {Promise<Object>} - The transaction history or error
   */
  async getTransactionHistory(userId, limit = 20) {
    try {
      const transactionsRef = collection(db, "transactions");
      const q = query(
        transactionsRef,
        where("userId", "==", userId),
        orderBy("createdAt", "desc"),
        limit(limit)
      );

      const snapshot = await getDocs(q);
      const transactions = [];

      snapshot.forEach((doc) => {
        transactions.push({
          id: doc.id,
          ...doc.data(),
        });
      });

      return {
        success: true,
        data: transactions,
      };
    } catch (error) {
      console.error("Error fetching transaction history:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

const walletService = new WalletService();
export default walletService;
