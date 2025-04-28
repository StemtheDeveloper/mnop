import {
  collection,
  addDoc,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  updateDoc,
  increment,
  serverTimestamp,
} from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { db } from "../config/firebase";
import notificationService from "./notificationService";

class InvestmentService {
  /**
   * Create a new investment
   * @param {string} userId - The investor's user ID
   * @param {string} productId - The product ID being invested in
   * @param {number} amount - The investment amount
   * @param {string} productName - The product name (for reference)
   * @returns {Promise<Object>} - The investment data or error
   */
  async createInvestment(userId, productId, amount, productName) {
    try {
      // Validate inputs
      if (!userId || !productId || !amount || amount <= 0) {
        throw new Error("Invalid investment parameters");
      }

      // Call the Cloud Function to process the investment
      const functions = getFunctions();
      const processInvestment = httpsCallable(functions, "processInvestment");

      const result = await processInvestment({
        userId,
        productId,
        amount,
        productName,
      });

      // Return the result
      return {
        success: true,
        data: {
          id: result.data.investmentId,
          amount,
          productId,
          productName,
          fundingProgress: result.data.fundingProgress,
          message: result.data.message,
        },
      };
    } catch (error) {
      console.error("Error creating investment:", error);
      return {
        success: false,
        error: error.message || "Failed to process investment",
      };
    }
  }

  /**
   * Get all investments for a user
   * @param {string} userId - The investor's user ID
   * @returns {Promise<Object>} - The user's investments or error
   */
  async getUserInvestments(userId) {
    try {
      const investmentsRef = collection(db, "investments");
      const q = query(
        investmentsRef,
        where("userId", "==", userId),
        orderBy("createdAt", "desc")
      );

      const snapshot = await getDocs(q);
      const investments = [];

      snapshot.forEach((doc) => {
        investments.push({
          id: doc.id,
          ...doc.data(),
        });
      });

      return {
        success: true,
        data: investments,
      };
    } catch (error) {
      console.error("Error getting user investments:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get all investments for a specific product
   * @param {string} productId - The product ID
   * @returns {Promise<Object>} - The product's investments or error
   */
  async getProductInvestments(productId) {
    try {
      const investmentsRef = collection(db, "investments");
      const q = query(
        investmentsRef,
        where("productId", "==", productId),
        orderBy("createdAt", "desc")
      );

      const snapshot = await getDocs(q);
      const investments = [];

      snapshot.forEach((doc) => {
        investments.push({
          id: doc.id,
          ...doc.data(),
        });
      });

      return {
        success: true,
        data: investments,
      };
    } catch (error) {
      console.error("Error getting product investments:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get total investment amount for a product
   * @param {string} productId - The product ID
   * @returns {Promise<Object>} - The total investment amount or error
   */
  async getProductTotalInvestment(productId) {
    try {
      const { success, data, error } = await this.getProductInvestments(
        productId
      );

      if (!success) {
        throw new Error(error);
      }

      const total = data.reduce(
        (sum, investment) => sum + investment.amount,
        0
      );

      return {
        success: true,
        data: { total },
      };
    } catch (error) {
      console.error("Error getting product total investment:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Update an investment's notes
   * @param {string} investmentId - The investment ID
   * @param {string} notes - The new notes
   * @returns {Promise<Object>} - Success or error
   */
  async updateInvestmentNotes(investmentId, notes) {
    try {
      const investmentRef = doc(db, "investments", investmentId);

      await updateDoc(investmentRef, {
        notes,
        updatedAt: serverTimestamp(),
      });

      return { success: true };
    } catch (error) {
      console.error("Error updating investment notes:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get investment returns (revenue sharing) for a user
   * @param {string} userId - The investor's user ID
   * @returns {Promise<Object>} - The user's investment returns or error
   */
  async getUserInvestmentReturns(userId) {
    try {
      const transactionsRef = collection(db, "transactions");
      const q = query(
        transactionsRef,
        where("userId", "==", userId),
        where("type", "==", "revenue_share"),
        orderBy("createdAt", "desc")
      );

      const snapshot = await getDocs(q);
      const returns = [];

      snapshot.forEach((doc) => {
        returns.push({
          id: doc.id,
          ...doc.data(),
        });
      });

      // Calculate totals
      const totalReturns = returns.reduce((sum, item) => sum + item.amount, 0);

      return {
        success: true,
        data: {
          returns,
          totalReturns,
          count: returns.length,
        },
      };
    } catch (error) {
      console.error("Error getting user investment returns:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get combined investment statistics for a user
   * @param {string} userId - The investor's user ID
   * @returns {Promise<Object>} - The user's investment statistics or error
   */
  async getInvestmentStatistics(userId) {
    try {
      // Get investments
      const investmentsResult = await this.getUserInvestments(userId);
      if (!investmentsResult.success) {
        throw new Error(investmentsResult.error);
      }

      // Get returns
      const returnsResult = await this.getUserInvestmentReturns(userId);
      if (!returnsResult.success) {
        throw new Error(returnsResult.error);
      }

      const investments = investmentsResult.data;
      const returns = returnsResult.data;

      // Calculate total invested
      const totalInvested = investments.reduce(
        (sum, investment) => sum + investment.amount,
        0
      );

      // Calculate ROI
      const roi =
        totalInvested > 0 ? (returns.totalReturns / totalInvested) * 100 : 0;

      return {
        success: true,
        data: {
          investments: {
            items: investments,
            total: totalInvested,
            count: investments.length,
          },
          returns: {
            items: returns.returns,
            total: returns.totalReturns,
            count: returns.count,
          },
          roi: Math.round(roi * 100) / 100, // ROI as percentage, rounded to 2 decimal places
          totalProfit: returns.totalReturns,
        },
      };
    } catch (error) {
      console.error("Error getting investment statistics:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

const investmentService = new InvestmentService();
export default investmentService;
