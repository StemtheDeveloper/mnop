const functions = require("firebase-functions");
const admin = require("firebase-admin");

// Initialize the app if it hasn't been initialized yet
try {
  admin.initializeApp();
} catch (e) {
  console.log("App initialization error", e);
}

const db = admin.firestore();
const INTEREST_RATE = 0.025; // 2.5% daily interest - would be much lower in production

/**
 * Daily interest calculation Cloud Function
 * This version is triggered by HTTP request (for testing)
 */
exports.calculateDailyInterestHttp = functions.https.onRequest(
  async (req, res) => {
    try {
      // Get all user wallets
      const walletsSnapshot = await db.collection("wallets").get();

      const batch = db.batch();
      const timestamp = admin.firestore.FieldValue.serverTimestamp();

      // Process each wallet
      for (const walletDoc of walletsSnapshot.docs) {
        // ...existing code...
      }

      await batch.commit();
      res.json({ success: true });
    } catch (error) {
      console.error("Error calculating daily interest:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

/**
 * Daily interest calculation Cloud Function - Scheduled version
 * Runs at midnight every day (server time)
 */
exports.dailyInterestCalculationScheduled = functions.pubsub
  .schedule("0 0 * * *") // Run at midnight every day
  .timeZone("America/New_York")
  .onRun(async (context) => {
    console.log("Starting daily interest calculation (scheduled)");

    // Get all user wallets
    const walletsSnapshot = await db.collection("wallets").get();

    const batch = db.batch();
    const timestamp = admin.firestore.FieldValue.serverTimestamp();

    // Process each wallet
    for (const walletDoc of walletsSnapshot.docs) {
      // ...existing code...
    }

    // Commit all updates atomically
    try {
      await batch.commit();
      console.log("Successfully calculated and added daily interest");
      return null; // Successful execution
    } catch (error) {
      console.error("Error calculating daily interest:", error);
      throw new Error(error); // Let Cloud Functions know there was an error
    }
  });

/**
 * Helper function to calculate daily interest
 * This can be called from either the HTTP or scheduled functions
 */
async function calculateInterestForAllWallets() {
  // Get all user wallets
  const walletsSnapshot = await db.collection("wallets").get();

  const batch = db.batch();
  const timestamp = admin.firestore.FieldValue.serverTimestamp();

  let totalInterestPaid = 0;
  let walletsUpdated = 0;

  // Process each wallet
  for (const walletDoc of walletsSnapshot.docs) {
    const walletData = walletDoc.data();
    const walletId = walletDoc.id;
    const balance = walletData.balance || 0;

    // Only calculate interest if balance is positive
    if (balance > 0) {
      const interestAmount = balance * INTEREST_RATE;
      totalInterestPaid += interestAmount;
      walletsUpdated++;

      // Update the wallet balance
      const walletRef = db.collection("wallets").doc(walletId);
      batch.update(walletRef, {
        balance: admin.firestore.FieldValue.increment(interestAmount),
      });

      // Create an interest history record
      const interestHistoryRef = db.collection("interestHistory").doc();
      batch.set(interestHistoryRef, {
        walletId,
        amount: interestAmount,
        rate: INTEREST_RATE,
        description: "Daily interest",
        createdAt: timestamp,
        previousBalance: balance,
        newBalance: balance + interestAmount,
      });
    }
  }

  // Return stats and batch for the caller to commit
  return {
    batch,
    totalInterestPaid,
    walletsUpdated,
  };
}
