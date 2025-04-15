import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../config/firebase";
import externalApiService from "./externalApiService";

class InterestService {
  /**
   * Get interest rate configuration from system settings
   * @returns {Promise<Object>} - The interest configuration or error
   */
  async getInterestRateConfig() {
    try {
      const settingsRef = doc(db, "systemSettings", "interestRates");
      const settingsDoc = await getDoc(settingsRef);

      if (settingsDoc.exists()) {
        return {
          success: true,
          data: settingsDoc.data(),
        };
      } else {
        // Return default values if no settings found
        return {
          success: true,
          data: {
            dailyRate: 0.0001, // 0.01% daily (≈ 3.65% annual)
            minBalance: 100,
            lastUpdated: new Date(),
          },
        };
      }
    } catch (error) {
      console.error("Error getting interest rate config:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get interest transactions for a user
   * @param {string} userId - User ID
   * @param {number} limit - Maximum number of transactions to return
   * @returns {Promise<Object>} - The interest transactions or error
   */
  async getUserInterestTransactions(userId, limitCount = 50) {
    try {
      const transactionsRef = collection(db, "transactions");
      const q = query(
        transactionsRef,
        where("userId", "==", userId),
        where("category", "==", "interest"),
        orderBy("createdAt", "desc"),
        limit(limitCount)
      );

      const snapshot = await getDocs(q);
      const transactions = [];

      snapshot.forEach((doc) => {
        transactions.push({
          id: doc.id,
          ...doc.data(),
        });
      });

      // Calculate total interest earned
      const totalInterest = transactions.reduce((sum, transaction) => {
        return sum + transaction.amount;
      }, 0);

      return {
        success: true,
        data: {
          transactions,
          totalInterest,
        },
      };
    } catch (error) {
      console.error("Error getting interest transactions:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Manually trigger interest calculation (admin only)
   * @param {number} interestRate - Custom interest rate for this run (optional)
   * @param {number} minBalance - Minimum balance to earn interest (optional)
   * @returns {Promise<Object>} - The result or error
   */
  async triggerInterestCalculation(interestRate = null, minBalance = null) {
    try {
      const triggerFn = httpsCallable(
        functions,
        "manuallyTriggerInterestCalculation"
      );

      const result = await triggerFn({
        interestRate,
        minBalance,
      });

      return {
        success: true,
        data: result.data,
      };
    } catch (error) {
      console.error("Error triggering interest calculation:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Calculate estimated interest for a given balance
   * @param {number} balance - Wallet balance
   * @param {number} days - Number of days to calculate for
   * @returns {Promise<Object>} - The estimated interest or error
   */
  async calculateEstimatedInterest(balance, days = 30) {
    try {
      // Get current interest rate
      const { success, data, error } = await this.getInterestRateConfig();

      if (!success) {
        throw new Error(error || "Failed to get interest rate");
      }

      const { dailyRate, minBalance } = data;

      // Check if balance meets minimum requirement
      if (balance < minBalance) {
        return {
          success: true,
          data: {
            dailyInterest: 0,
            totalInterest: 0,
            effectiveAnnualRate: dailyRate * 365 * 100,
            meetsMinimumBalance: false,
            minBalanceRequired: minBalance,
          },
        };
      }

      // Calculate daily interest (simple interest for estimation)
      const dailyInterest = balance * dailyRate;
      const totalInterest = dailyInterest * days;

      return {
        success: true,
        data: {
          dailyInterest,
          totalInterest,
          effectiveAnnualRate: dailyRate * 365 * 100, // Convert to percentage
          meetsMinimumBalance: true,
          minBalanceRequired: minBalance,
        },
      };
    } catch (error) {
      console.error("Error calculating estimated interest:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Update interest rate configuration with external market rates
   * @param {boolean} [useMarketRate=true] - Whether to use market rate or use a manual offset
   * @param {number} [manualRateOffset=0] - Offset to add to market rate (in percentage points)
   * @returns {Promise<Object>} - The updated interest configuration or error
   */
  async updateInterestRatesFromMarket(
    useMarketRate = true,
    manualRateOffset = 0
  ) {
    try {
      // Fetch current market rates
      const ratesResult = await externalApiService.fetchFinancialIndicators();

      if (!ratesResult.success) {
        throw new Error(ratesResult.error || "Failed to fetch market rates");
      }

      // Get current configuration
      const { success, data: currentConfig } =
        await this.getInterestRateConfig();

      if (!success) {
        throw new Error("Failed to get current interest rate configuration");
      }

      // Calculate new daily rate based on 3-Month Treasury
      const treasuryRate = ratesResult.data.treasury3Month;
      let newDailyRate;

      if (useMarketRate && treasuryRate) {
        // Use treasury rate as base, add offset, then convert to daily rate
        // Adding 0.5% as a base spread over treasury (can be adjusted)
        const baseSpread = 0.5;
        const offsetPercentage = manualRateOffset;
        const annualRate = treasuryRate.value + baseSpread + offsetPercentage;
        newDailyRate = annualRate / 365 / 100; // Convert to daily decimal rate
      } else {
        // Fallback to current rate if market data isn't available or not used
        newDailyRate = currentConfig.dailyRate;
      }

      // Prepare updated config with market data
      const updatedConfig = {
        dailyRate: newDailyRate,
        minBalance: currentConfig.minBalance, // Preserve existing minimum balance
        lastUpdated: serverTimestamp(),
        marketData: {
          federalFundsRate: ratesResult.data.federalFundsRate?.value || null,
          treasury3Month: ratesResult.data.treasury3Month?.value || null,
          treasury6Month: ratesResult.data.treasury6Month?.value || null,
          fetchedAt: ratesResult.data.fetchedAt,
        },
        useMarketRate,
        manualRateOffset,
      };

      // Save to Firestore
      const settingsRef = doc(db, "systemSettings", "interestRates");
      await setDoc(settingsRef, updatedConfig);

      return {
        success: true,
        data: {
          ...updatedConfig,
          effectiveAnnualRate: newDailyRate * 365 * 100, // Convert to percentage
        },
      };
    } catch (error) {
      console.error("Error updating interest rates from market:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get total interest earned by a user
   * @param {string} userId - User ID
   * @returns {Promise<Object>} - Total interest earned or error
   */
  async getTotalInterestEarned(userId) {
    try {
      const transactionsRef = collection(db, "transactions");
      const q = query(
        transactionsRef,
        where("userId", "==", userId),
        where("category", "==", "interest")
      );

      const snapshot = await getDocs(q);
      let totalInterest = 0;

      snapshot.forEach((doc) => {
        const transaction = doc.data();
        totalInterest += transaction.amount || 0;
      });

      return {
        success: true,
        data: { totalInterest },
      };
    } catch (error) {
      console.error("Error getting total interest earned:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

const interestService = new InterestService();
export default interestService;
