import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "../config/firebase";
import walletService from "./walletService";

class InterestService {
  /**
   * Calculate and apply interest for a user's wallet balance
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Result with success status
   */
  async calculateAndApplyInterest(userId) {
    try {
      // Get the user's current wallet
      const wallet = await walletService.getUserWallet(userId);
      if (!wallet) {
        return { success: false, error: "Wallet not found" };
      }

      // Calculate interest (simplified for demo)
      const interestRate = 0.035 / 12; // 3.5% annual rate, calculated monthly
      const interestAmount = wallet.balance * interestRate;
      const roundedAmount = Math.round(interestAmount * 100) / 100; // Round to 2 decimal places

      if (roundedAmount <= 0) {
        return { success: true, data: { amount: 0 } };
      }

      // Record interest transaction
      const transaction = {
        userId,
        type: "deposit",
        category: "interest",
        amount: roundedAmount,
        description: "Monthly interest payment",
        status: "completed",
        createdAt: serverTimestamp(),
      };

      await addDoc(collection(db, "transactions"), transaction);

      // Update wallet balance
      await walletService.simulateDeposit(
        userId,
        roundedAmount,
        "Interest payment"
      );

      return {
        success: true,
        data: {
          amount: roundedAmount,
          rate: interestRate,
          date: new Date(),
        },
      };
    } catch (error) {
      console.error("Error calculating interest:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get all interest transactions for a user
   * @param {string} userId - User ID
   * @param {number} maxResults - Maximum number of transactions to retrieve
   * @returns {Promise<Array>} - Interest transactions
   */
  async getUserInterestTransactions(userId, maxResults = 50) {
    try {
      const transactionsRef = collection(db, "transactions");

      // Try using the proper query with fallback logic
      try {
        const q = query(
          transactionsRef,
          where("userId", "==", userId),
          where("category", "==", "interest"),
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
          "Index error for interest transactions. Falling back to unordered query:",
          indexError.message
        );

        const fallbackQuery = query(
          transactionsRef,
          where("userId", "==", userId),
          where("category", "==", "interest"),
          limit(maxResults * 2) // Get more since we'll sort client-side
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
      console.error("Error getting interest transactions:", error);
      return [];
    }
  }

  /**
   * Get interest rates
   * @returns {Promise<Object>} Interest rate data
   */
  async getInterestRates() {
    try {
      const ratesRef = doc(db, "settings", "interestRates");
      const ratesDoc = await getDoc(ratesRef);

      if (ratesDoc.exists()) {
        return { success: true, data: ratesDoc.data() };
      }

      // Return default rates if not found
      return {
        success: true,
        data: {
          baseRate: 0.035, // 3.5% annual rate
          tiers: [
            { min: 0, rate: 0.035 },
            { min: 10000, rate: 0.04 },
            { min: 50000, rate: 0.045 },
          ],
          updatedAt: new Date(),
        },
      };
    } catch (error) {
      console.error("Error getting interest rates:", error);
      return { success: false, error: error.message };
    }
  }
}

const interestService = new InterestService();
export default interestService;
