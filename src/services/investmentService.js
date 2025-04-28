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
  arrayUnion,
  Timestamp,
  deleteDoc
} from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { db } from "../config/firebase";
import notificationService from "./notificationService";
import walletService from "./walletService";

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

  /**
   * Request to withdraw/pull funding from a product
   * @param {string} investmentId - The investment ID
   * @param {string} userId - The investor's user ID
   * @param {string} reason - Optional reason for pulling funding
   * @returns {Promise<Object>} - Success or error
   */
  async requestPullFunding(investmentId, userId, reason = '') {
    try {
      // 1. Get the settings to determine notice period
      const settingsRef = doc(db, "settings", "investmentSettings");
      const settingsDoc = await getDoc(settingsRef);
      
      // Default to 7 days if no settings found
      const noticePeriodDays = settingsDoc.exists() ? 
        (settingsDoc.data().pullFundingNoticeDays || 7) : 7;
      
      // Calculate the withdrawal date based on notice period
      const currentDate = new Date();
      const withdrawalDate = new Date(currentDate);
      withdrawalDate.setDate(currentDate.getDate() + noticePeriodDays);
      
      // 2. Get the investment to validate
      const investmentRef = doc(db, "investments", investmentId);
      const investmentDoc = await getDoc(investmentRef);
      
      if (!investmentDoc.exists()) {
        return {
          success: false,
          error: "Investment not found"
        };
      }
      
      const investmentData = investmentDoc.data();
      
      // 3. Verify the investment belongs to the user
      if (investmentData.userId !== userId) {
        return {
          success: false,
          error: "You don't have permission to pull this investment"
        };
      }
      
      // 4. Check if the product is already fully funded
      const productRef = doc(db, "products", investmentData.productId);
      const productDoc = await getDoc(productRef);
      
      if (!productDoc.exists()) {
        return {
          success: false,
          error: "Product not found"
        };
      }
      
      const productData = productDoc.data();
      const isFullyFunded = productData.currentFunding >= productData.fundingGoal;
      
      if (isFullyFunded) {
        return {
          success: false,
          error: "Cannot pull funding from a product that has already reached its funding goal"
        };
      }
      
      // 5. Update investment status to pending_withdrawal
      await updateDoc(investmentRef, {
        status: "pending_withdrawal",
        withdrawalRequestDate: serverTimestamp(),
        scheduledWithdrawalDate: Timestamp.fromDate(withdrawalDate),
        withdrawalReason: reason,
        updatedAt: serverTimestamp()
      });
      
      // 6. Notify the product designer about the withdrawal request
      if (investmentData.designerId) {
        await notificationService.createNotification(
          investmentData.designerId,
          "investment_withdrawal",
          "Investment Withdrawal Request",
          `An investor has requested to withdraw their ${investmentData.amount} investment from your product "${investmentData.productName}". The funds will be withdrawn on ${withdrawalDate.toLocaleDateString()}.`,
          `/product/${investmentData.productId}`
        );
      }
      
      return {
        success: true,
        message: `Your request to withdraw funding has been submitted. The funds will be returned to your wallet on ${withdrawalDate.toLocaleDateString()}.`,
        withdrawalDate: withdrawalDate
      };
      
    } catch (error) {
      console.error("Error requesting to pull funding:", error);
      return {
        success: false,
        error: error.message || "Failed to request funding withdrawal"
      };
    }
  }

  /**
   * Process any pending investment withdrawals that have reached their withdrawal date
   * This would typically be run by a scheduled function
   * @returns {Promise<Object>} - Result of processing withdrawals
   */
  async processPendingWithdrawals() {
    try {
      const currentDate = new Date();
      const investmentsRef = collection(db, "investments");
      const q = query(
        investmentsRef,
        where("status", "==", "pending_withdrawal"),
        where("scheduledWithdrawalDate", "<=", Timestamp.fromDate(currentDate))
      );
      
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        return {
          success: true,
          message: "No pending withdrawals to process",
          processed: 0
        };
      }
      
      let processedCount = 0;
      let failedCount = 0;
      
      for (const doc of snapshot.docs) {
        const investment = {
          id: doc.id,
          ...doc.data()
        };
        
        try {
          // Process the actual withdrawal for this investment
          const result = await this.completePullFunding(investment.id, investment.userId);
          
          if (result.success) {
            processedCount++;
          } else {
            failedCount++;
            console.error(`Failed to process withdrawal for investment ${investment.id}:`, result.error);
          }
        } catch (err) {
          failedCount++;
          console.error(`Error processing withdrawal for investment ${investment.id}:`, err);
        }
      }
      
      return {
        success: true,
        message: `Processed ${processedCount} withdrawals (${failedCount} failed)`,
        processed: processedCount,
        failed: failedCount
      };
      
    } catch (error) {
      console.error("Error processing pending withdrawals:", error);
      return {
        success: false,
        error: error.message || "Failed to process pending withdrawals"
      };
    }
  }

  /**
   * Complete the withdrawal of an investment - return funds to investor and update product
   * @param {string} investmentId - The investment ID
   * @param {string} userId - The investor's user ID 
   * @returns {Promise<Object>} - Success or error
   */
  async completePullFunding(investmentId, userId) {
    try {
      // 1. Get the investment data
      const investmentRef = doc(db, "investments", investmentId);
      const investmentDoc = await getDoc(investmentRef);
      
      if (!investmentDoc.exists()) {
        return {
          success: false,
          error: "Investment not found"
        };
      }
      
      const investment = investmentDoc.data();
      
      // Verify the investment belongs to the user
      if (investment.userId !== userId) {
        return {
          success: false,
          error: "You don't have permission to pull this investment"
        };
      }
      
      // Verify the investment status is pending_withdrawal
      if (investment.status !== "pending_withdrawal") {
        return {
          success: false,
          error: "This investment is not pending withdrawal"
        };
      }
      
      // 2. Get the product data
      const productRef = doc(db, "products", investment.productId);
      const productDoc = await getDoc(productRef);
      
      if (!productDoc.exists()) {
        return {
          success: false,
          error: "Product not found"
        };
      }
      
      const product = productDoc.data();
      
      // 3. Check again that the product is not fully funded
      if (product.currentFunding >= product.fundingGoal) {
        await updateDoc(investmentRef, {
          status: "active", // Revert back to active
          withdrawalRequestDate: null,
          scheduledWithdrawalDate: null,
          withdrawalReason: null,
          withdrawalCancellationReason: "Product became fully funded before withdrawal could be processed",
          updatedAt: serverTimestamp()
        });
        
        return {
          success: false,
          error: "Cannot pull funding from a product that has reached its funding goal"
        };
      }
      
      // 4. Process the withdrawal transaction
      // Return funds to investor
      const walletResult = await walletService.getUserWallet(userId);
      
      if (!walletResult) {
        // Create wallet if it doesn't exist
        await walletService.createUserWallet(userId);
      }
      
      // Add funds back to the user's wallet
      await walletService.addToWallet(userId, investment.amount, 
        `Refund from investment withdrawal - ${investment.productName}`);
      
      // 5. Update the product funding
      await updateDoc(productRef, {
        currentFunding: increment(-investment.amount),
        updatedAt: serverTimestamp()
      });
      
      // 6. Record the investment withdrawal transaction
      const transactionRef = collection(db, "transactions");
      await addDoc(transactionRef, {
        userId: userId,
        amount: investment.amount,
        type: "investment_withdrawal",
        description: `Withdrawal of investment from ${investment.productName}`,
        productId: investment.productId,
        investmentId: investmentId,
        createdAt: serverTimestamp(),
        status: "completed"
      });
      
      // 7. Update the investment status to withdrawn
      await updateDoc(investmentRef, {
        status: "withdrawn",
        withdrawalCompletedDate: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      // 8. Notify the investor
      await notificationService.createNotification(
        userId,
        "investment_withdrawal_completed",
        "Investment Withdrawal Completed",
        `Your investment of ${investment.amount} in "${investment.productName}" has been withdrawn and returned to your wallet.`,
        "/portfolio"
      );
      
      // 9. Notify the product designer
      if (investment.designerId) {
        await notificationService.createNotification(
          investment.designerId,
          "investment_withdrawal_completed",
          "Investment Withdrawal Completed",
          `An investor has withdrawn their ${investment.amount} investment from your product "${investment.productName}".`,
          `/product/${investment.productId}`
        );
      }
      
      return {
        success: true,
        message: `Successfully withdrew investment of ${investment.amount} from "${investment.productName}"`
      };
      
    } catch (error) {
      console.error("Error completing funding withdrawal:", error);
      return {
        success: false,
        error: error.message || "Failed to complete funding withdrawal"
      };
    }
  }

  /**
   * Cancel a pending withdrawal request
   * @param {string} investmentId - The investment ID
   * @param {string} userId - The investor's user ID
   * @param {string} reason - Optional reason for cancellation
   * @returns {Promise<Object>} - Success or error
   */
  async cancelPullFundingRequest(investmentId, userId, reason = '') {
    try {
      // 1. Get the investment data
      const investmentRef = doc(db, "investments", investmentId);
      const investmentDoc = await getDoc(investmentRef);
      
      if (!investmentDoc.exists()) {
        return {
          success: false,
          error: "Investment not found"
        };
      }
      
      const investment = investmentDoc.data();
      
      // 2. Verify the investment belongs to the user
      if (investment.userId !== userId) {
        return {
          success: false,
          error: "You don't have permission to cancel this withdrawal request"
        };
      }
      
      // 3. Verify the investment status is pending_withdrawal
      if (investment.status !== "pending_withdrawal") {
        return {
          success: false,
          error: "This investment is not pending withdrawal"
        };
      }
      
      // 4. Update the investment status back to active
      await updateDoc(investmentRef, {
        status: "active",
        withdrawalRequestDate: null,
        scheduledWithdrawalDate: null,
        withdrawalReason: null,
        withdrawalCancellationReason: reason,
        updatedAt: serverTimestamp()
      });
      
      // 5. Notify the product designer
      if (investment.designerId) {
        await notificationService.createNotification(
          investment.designerId,
          "investment_withdrawal_canceled",
          "Investment Withdrawal Canceled",
          `An investor has canceled their request to withdraw their ${investment.amount} investment from your product "${investment.productName}".`,
          `/product/${investment.productId}`
        );
      }
      
      return {
        success: true,
        message: "Your withdrawal request has been canceled"
      };
      
    } catch (error) {
      console.error("Error canceling funding withdrawal request:", error);
      return {
        success: false,
        error: error.message || "Failed to cancel withdrawal request"
      };
    }
  }

  /**
   * Get details of pending withdrawals for a product
   * @param {string} productId - The product ID
   * @returns {Promise<Object>} - The pending withdrawals data or error
   */
  async getProductPendingWithdrawals(productId) {
    try {
      const investmentsRef = collection(db, "investments");
      const q = query(
        investmentsRef,
        where("productId", "==", productId),
        where("status", "==", "pending_withdrawal"),
        orderBy("scheduledWithdrawalDate", "asc")
      );
      
      const snapshot = await getDocs(q);
      const pendingWithdrawals = [];
      
      snapshot.forEach((doc) => {
        pendingWithdrawals.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      // Calculate total amount being withdrawn
      const totalWithdrawalAmount = pendingWithdrawals.reduce(
        (sum, withdrawal) => sum + withdrawal.amount, 0
      );
      
      return {
        success: true,
        data: {
          items: pendingWithdrawals,
          total: totalWithdrawalAmount,
          count: pendingWithdrawals.length
        }
      };
      
    } catch (error) {
      console.error("Error getting product pending withdrawals:", error);
      return {
        success: false,
        error: error.message || "Failed to get pending withdrawals"
      };
    }
  }

  /**
   * Get the notice period for pulling funding
   * @returns {Promise<Object>} - The notice period in days or error
   */
  async getNoticePeriod() {
    try {
      const settingsRef = doc(db, "settings", "investmentSettings");
      const settingsDoc = await getDoc(settingsRef);
      
      // Default to 7 days if no settings found
      const noticePeriodDays = settingsDoc.exists() ? 
        (settingsDoc.data().pullFundingNoticeDays || 7) : 7;
      
      return {
        success: true,
        data: { noticePeriodDays }
      };
      
    } catch (error) {
      console.error("Error getting notice period:", error);
      return {
        success: false,
        error: error.message || "Failed to get notice period",
        data: { noticePeriodDays: 7 } // Default fallback
      };
    }
  }

  /**
   * Update the notice period for pulling funding (admin only)
   * @param {number} days - The new notice period in days
   * @returns {Promise<Object>} - Success or error
   */
  async updateNoticePeriod(days) {
    try {
      if (!days || days < 0) {
        return {
          success: false,
          error: "Invalid notice period. Must be a positive number."
        };
      }
      
      const settingsRef = doc(db, "settings", "investmentSettings");
      const settingsDoc = await getDoc(settingsRef);
      
      if (settingsDoc.exists()) {
        await updateDoc(settingsRef, {
          pullFundingNoticeDays: days,
          updatedAt: serverTimestamp()
        });
      } else {
        // Create settings document if it doesn't exist
        await setDoc(settingsRef, {
          pullFundingNoticeDays: days,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
      
      return {
        success: true,
        message: `Notice period updated to ${days} days`
      };
      
    } catch (error) {
      console.error("Error updating notice period:", error);
      return {
        success: false,
        error: error.message || "Failed to update notice period"
      };
    }
  }
}

const investmentService = new InvestmentService();
export default investmentService;
