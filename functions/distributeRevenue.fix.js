// This is a file to fix the revenue distribution issue
// Once we confirm the fix works, we can merge these changes into distributeRevenue.js

const admin = require("firebase-admin");

/**
 * Add debug logs to identify why revenue distribution isn't working
 * This should be called after the existing function with an existing transaction
 */
exports.debugRevenueDistribution = async (transactionId) => {
  try {
    const db = admin.firestore();

    // 1. Check if the transaction exists
    const transactionRef = db.collection("transactions").doc(transactionId);
    const transactionDoc = await transactionRef.get();

    if (!transactionDoc.exists) {
      return { success: false, error: "Transaction not found" };
    }

    const transactionData = transactionDoc.data();

    // 2. Check wallet update
    if (transactionData.userId) {
      const walletRef = db.collection("wallets").doc(transactionData.userId);
      const walletDoc = await walletRef.get();

      const walletExists = walletDoc.exists;
      const walletData = walletExists ? walletDoc.data() : null;

      return {
        success: true,
        transactionType: transactionData.type,
        transactionAmount: transactionData.amount,
        transactionStatus: transactionData.status,
        walletExists,
        walletBalance: walletData ? walletData.balance : null,
        notificationsOn: !!transactionData.userId,
        userId: transactionData.userId,
        description: transactionData.description,
      };
    }

    return {
      success: false,
      error: "No user ID associated with transaction",
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || "Failed to debug revenue distribution",
    };
  }
};
