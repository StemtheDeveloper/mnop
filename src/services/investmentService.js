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
  runTransaction,
} from "firebase/firestore";
import { db } from "../config/firebase";
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

      // Get the product details to verify it's valid and get additional info
      const productRef = doc(db, "products", productId);
      const productDoc = await getDoc(productRef);

      if (!productDoc.exists()) {
        throw new Error("Product not found");
      }

      const productData = productDoc.data();

      // Check if the product is in funding phase (can be customized based on your business logic)
      if (
        productData.status !== "funding" &&
        productData.status !== "active" &&
        productData.status !== "open"
      ) {
        throw new Error("This product is not currently accepting investments");
      }

      // Use a Firestore transaction to ensure atomicity
      try {
        const result = await runTransaction(db, async (transaction) => {
          // 1. Check wallet balance first
          const userRef = doc(db, "users", userId);
          const userDoc = await transaction.get(userRef);

          if (!userDoc.exists()) {
            throw new Error("User not found");
          }

          const userData = userDoc.data();

          if (!userData.wallet || userData.wallet.balance < amount) {
            throw new Error("Insufficient funds in wallet");
          }

          // 2. Deduct amount from wallet
          transaction.update(userRef, {
            "wallet.balance": increment(-amount),
            "wallet.lastUpdated": serverTimestamp(),
          });

          // 3. Refresh product data to get current funding status
          const freshProductDoc = await transaction.get(productRef);
          const freshProductData = freshProductDoc.data();
          const currentFunding = freshProductData.fundingProgress || 0;

          // 4. Update product's funding progress
          transaction.update(productRef, {
            fundingProgress: increment(amount),
            updatedAt: serverTimestamp(),
            // If this is the first investment, update the product status if necessary
            ...(currentFunding === 0 && { status: "funding" }),
          });

          // 5. Create the investment record as part of the transaction
          const investmentData = {
            userId,
            productId,
            productName: productName || freshProductData.name,
            amount,
            status: "active",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            notes: "",
          };

          // We need to return the data to use it after transaction
          return {
            userData,
            investmentData,
            fundingProgress: currentFunding + amount,
          };
        });

        // Create investment record after successful transaction
        const investmentsRef = collection(db, "investments");
        const investmentRef = await addDoc(
          investmentsRef,
          result.investmentData
        );

        // Record the transaction in the transaction history
        await walletService.recordTransaction(userId, {
          type: "debit",
          amount,
          description: `Investment in ${productName || "product"}`,
          status: "completed",
        });

        return {
          success: true,
          data: {
            id: investmentRef.id,
            ...result.investmentData,
            fundingProgress: result.fundingProgress,
          },
        };
      } catch (transactionError) {
        console.error("Transaction failed:", transactionError);
        throw new Error(
          transactionError.message || "Investment transaction failed"
        );
      }
    } catch (error) {
      console.error("Error creating investment:", error);
      return {
        success: false,
        error: error.message,
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
}

const investmentService = new InvestmentService();
export default investmentService;
