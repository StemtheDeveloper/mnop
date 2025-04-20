import { db } from "../config/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  addDoc,
  serverTimestamp,
  orderBy,
  limit,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { functions } from "../config/firebase";

class InterestService {
  /**
   * Calculate and apply interest for a user's wallet balance
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Result with success status
   */
  async calculateAndApplyInterest(userId) {
    try {
      // Call the Firebase function to calculate interest
      const calculateInterest = httpsCallable(
        functions,
        "calculateInterestForUser"
      );
      const result = await calculateInterest({ userId });

      return {
        success: true,
        data: result.data,
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
   * @returns {Promise<Object>} - Interest transactions result
   */
  async getInterestHistory(userId, maxResults = 50) {
    try {
      const interestHistoryRef = collection(db, "interestHistory");
      const q = query(
        interestHistoryRef,
        where("userId", "==", userId),
        orderBy("createdAt", "desc"),
        limit(maxResults)
      );

      const querySnapshot = await getDocs(q);
      const history = [];

      querySnapshot.forEach((doc) => {
        history.push({
          id: doc.id,
          ...doc.data(),
        });
      });

      return {
        success: true,
        data: { history },
      };
    } catch (error) {
      console.error("Error fetching interest history:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get interest rates configuration
   * @returns {Promise<Object>} Interest rate data
   */
  async getInterestRates() {
    try {
      const configDoc = await getDoc(doc(db, "systemConfig", "interestRates"));

      if (!configDoc.exists()) {
        return {
          success: false,
          error: "Interest rate configuration not found",
        };
      }

      // Return the interest rate configuration
      return {
        success: true,
        data: configDoc.data(),
      };
    } catch (error) {
      console.error("Error fetching interest rates:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Estimate interest earnings based on a balance
   * @param {number} balance - The balance to calculate interest on
   * @returns {Promise<Object>} Estimated interest earnings
   */
  async estimateInterestEarnings(balance) {
    try {
      // Get current interest rates
      const ratesResult = await this.getInterestRates();

      if (!ratesResult.success) {
        return ratesResult; // Return error from getting rates
      }

      const rates = ratesResult.data;

      // Check if balance meets minimum requirements
      if (balance < rates.minBalance) {
        return {
          success: true,
          data: {
            dailyInterest: 0,
            monthlyInterest: 0,
            yearlyInterest: 0,
            annualRate: rates.baseRate,
            message: `Balance must be at least ${rates.minBalance} to earn interest.`,
          },
        };
      }

      // Determine applicable interest rate based on balance tiers
      let applicableRate = rates.baseRate;
      let applicableTier = null;

      if (rates.tiers && rates.tiers.length > 0) {
        // Sort tiers by minimum amount (descending)
        const sortedTiers = [...rates.tiers].sort((a, b) => b.min - a.min);

        // Find the highest tier the balance qualifies for
        for (const tier of sortedTiers) {
          if (balance >= tier.min) {
            applicableRate = tier.rate;
            applicableTier = tier;
            break;
          }
        }
      }

      // Calculate daily, monthly and yearly interest
      const dailyRate = applicableRate / 365;
      const dailyInterest = balance * dailyRate;
      const monthlyInterest = dailyInterest * 30; // Approximate
      const yearlyInterest = balance * applicableRate;

      return {
        success: true,
        data: {
          dailyInterest,
          monthlyInterest,
          yearlyInterest,
          annualRate: applicableRate,
          applicableTier,
        },
      };
    } catch (error) {
      console.error("Error estimating interest:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Admin function to update interest rate configuration
   * @param {Object} rateConfig - New interest rate configuration
   * @returns {Promise<Object>} Result with success status
   */
  async updateInterestRates(rateConfig) {
    try {
      // Ensure the user has admin permissions (this should be checked at the UI level too)

      // Update the interest rate configuration
      await db.doc("systemConfig/interestRates").set(rateConfig);

      return {
        success: true,
        message: "Interest rates updated successfully",
      };
    } catch (error) {
      console.error("Error updating interest rates:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Admin function to trigger interest calculation for all users
   * @returns {Promise<Object>} Result with success status
   */
  async triggerInterestCalculation() {
    try {
      // Call the Firebase function to trigger interest calculation
      const triggerCalculation = httpsCallable(
        functions,
        "manualTriggerInterestCalculation"
      );
      const result = await triggerCalculation();

      return {
        success: true,
        data: result.data,
      };
    } catch (error) {
      console.error("Error triggering interest calculation:", error);
      return { success: false, error: error.message };
    }
  }
}

// Create and export a singleton instance
const interestService = new InterestService();
export default interestService;
