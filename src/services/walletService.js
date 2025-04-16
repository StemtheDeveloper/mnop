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
} from "firebase/firestore";
import { db } from "../config/firebase";

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
      // First find the recipient by email
      const usersRef = collection(db, "users");
      const recipientQuery = query(usersRef, where("email", "==", toEmail));
      const recipientSnapshot = await getDocs(recipientQuery);

      if (recipientSnapshot.empty) {
        return { success: false, error: "Recipient not found" };
      }

      // Get recipient user ID
      const recipient = recipientSnapshot.docs[0];
      const toUserId = recipient.id;

      // Don't allow transfers to self
      if (fromUserId === toUserId) {
        return { success: false, error: "Cannot transfer to yourself" };
      }

      // Check sender balance
      const fromWallet = await this.getUserWallet(fromUserId);
      if (!fromWallet || fromWallet.balance < amount) {
        return { success: false, error: "Insufficient funds" };
      }

      // Initialize recipient wallet if needed
      await this.getUserWallet(toUserId);

      // Update sender's wallet (deduct amount)
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

      // Update recipient's wallet (add amount)
      const toWalletRef = doc(db, "wallets", toUserId);
      await updateDoc(toWalletRef, {
        balance: increment(amount),
        updatedAt: serverTimestamp(),
      });

      // Record credit transaction for recipient
      await this.recordTransaction(toUserId, {
        type: "transfer",
        amount: amount,
        description: `Transfer from ${fromUserId}${note ? ": " + note : ""}`,
        status: "completed",
        senderId: fromUserId,
      });

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

      return { success: true };
    } catch (error) {
      console.error("Error deducting funds:", error);
      throw error;
    }
  }

  /**
   * Get transaction history for a user
   * @param {string} userId - User ID
   * @param {number} maxResults - Maximum number of transactions to retrieve
   * @returns {Promise<Array>} Transaction history
   */
  async getTransactionHistory(userId, maxResults = 50) {
    try {
      const transactionsRef = collection(db, "transactions");

      // First try using the ordered query with fallback logic
      try {
        const q = query(
          transactionsRef,
          where("userId", "==", userId),
          orderBy("createdAt", "desc"),
          limit(maxResults)
        );

        const snapshot = await getDocs(q);

        return snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate() || new Date(),
        }));
      } catch (indexError) {
        // If index error occurs, fall back to unordered query
        console.warn(
          "Index error for transactions. Falling back to unordered query:",
          indexError.message
        );

        const fallbackQuery = query(
          transactionsRef,
          where("userId", "==", userId),
          limit(maxResults * 2) // Get more results since we'll sort client-side
        );

        const snapshot = await getDocs(fallbackQuery);

        // Process transactions and sort client-side
        const transactions = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          createdAt:
            doc.data().createdAt instanceof Timestamp
              ? doc.data().createdAt.toDate()
              : doc.data().createdAt
              ? new Date(doc.data().createdAt)
              : new Date(),
        }));

        // Sort by date (most recent first)
        transactions.sort((a, b) => b.createdAt - a.createdAt);

        // Return limited results
        return transactions.slice(0, maxResults);
      }
    } catch (error) {
      console.error("Error getting transaction history:", error);
      return [];
    }
  }
}

const walletService = new WalletService();
export default walletService;
