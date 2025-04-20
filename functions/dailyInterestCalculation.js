const functions = require("firebase-functions");
const admin = require("firebase-admin");

// Initialize the app if it hasn't been initialized yet
try {
  admin.initializeApp();
} catch (e) {
  console.log("App initialization error", e);
}

const db = admin.firestore();

/**
 * Daily interest calculation Cloud Function
 * This version is triggered by HTTP request (for testing)
 */
exports.calculateDailyInterestHttp = functions.https.onRequest(
  async (req, res) => {
    try {
      const result = await calculateInterestForAllWallets();
      await result.batch.commit();

      res.json({
        success: true,
        totalInterestPaid: result.totalInterestPaid,
        walletsUpdated: result.walletsUpdated,
        timestamp: new Date().toISOString(),
      });
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

    try {
      const result = await calculateInterestForAllWallets();
      await result.batch.commit();

      console.log(`Successfully calculated and added daily interest:
        - Total interest paid: ${result.totalInterestPaid.toFixed(2)}
        - Wallets updated: ${result.walletsUpdated}
        - Time: ${new Date().toISOString()}`);

      return null; // Successful execution
    } catch (error) {
      console.error("Error calculating daily interest:", error);
      throw new Error(error); // Let Cloud Functions know there was an error
    }
  });

/**
 * Calculate interest for a specific user
 * For manual testing or admin-triggered interest payments
 */
exports.calculateInterestForUser = functions.https.onCall(
  async (data, context) => {
    // Only allow admin to call this function
    if (!context.auth || !context.auth.token.admin) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Only admins can manually calculate interest"
      );
    }

    const userId = data.userId;
    if (!userId) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "User ID is required"
      );
    }

    try {
      const result = await calculateInterestForSingleUser(userId);
      if (result.success) {
        return {
          success: true,
          interest: result.interest,
          message: `Interest of ${result.interest.toFixed(
            2
          )} added to user wallet`,
        };
      } else {
        return {
          success: false,
          message: result.message,
        };
      }
    } catch (error) {
      console.error(`Error calculating interest for user ${userId}:`, error);
      throw new functions.https.HttpsError(
        "internal",
        "Error calculating interest",
        error.message
      );
    }
  }
);

/**
 * Helper function to calculate daily interest
 * This can be called from either the HTTP or scheduled functions
 */
async function calculateInterestForAllWallets() {
  // Get interest rate configuration from settings
  let interestRateAnnual = 0.035; // Default 3.5% annual rate
  let minBalance = 0; // Default $0 minimum balance

  try {
    const settingsDoc = await db
      .collection("settings")
      .doc("interestRates")
      .get();
    if (settingsDoc.exists) {
      const settings = settingsDoc.data();
      interestRateAnnual = settings.baseRate || interestRateAnnual;
      minBalance = settings.minBalance || minBalance;
    }
  } catch (error) {
    console.log(
      "Error fetching interest rate settings, using defaults:",
      error
    );
  }

  // Calculate daily rate from annual rate
  const dailyRate = interestRateAnnual / 365;

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

    // Only calculate interest if balance is greater than minimum required
    if (balance > minBalance) {
      // Calculate interest amount
      const interestAmount = balance * dailyRate;
      // Round to 2 decimal places for currency
      const roundedInterest = Math.round(interestAmount * 100) / 100;

      if (roundedInterest > 0) {
        totalInterestPaid += roundedInterest;
        walletsUpdated++;

        // Update the wallet balance
        const walletRef = db.collection("wallets").doc(walletId);
        batch.update(walletRef, {
          balance: admin.firestore.FieldValue.increment(roundedInterest),
          updatedAt: timestamp,
        });

        // Create a transaction record
        const transactionRef = db.collection("transactions").doc();
        batch.set(transactionRef, {
          userId: walletId, // walletId is userId in our system
          type: "deposit",
          category: "interest",
          amount: roundedInterest,
          description: "Daily interest payment",
          status: "completed",
          createdAt: timestamp,
        });

        // Create an interest history record
        const interestHistoryRef = db.collection("interestHistory").doc();
        batch.set(interestHistoryRef, {
          userId: walletId,
          amount: roundedInterest,
          rate: dailyRate,
          annualRate: interestRateAnnual,
          description: "Daily interest",
          createdAt: timestamp,
          previousBalance: balance,
          newBalance: balance + roundedInterest,
        });
      }
    }
  }

  // Return stats and batch for the caller to commit
  return {
    batch,
    totalInterestPaid,
    walletsUpdated,
    dailyRate,
  };
}

/**
 * Calculate interest for a single user
 * @param {string} userId - The user ID
 * @returns {Promise<Object>} Result with success status
 */
async function calculateInterestForSingleUser(userId) {
  // Get interest rate configuration from settings
  let interestRateAnnual = 0.035; // Default 3.5% annual rate
  let minBalance = 0; // Default $0 minimum balance

  try {
    const settingsDoc = await db
      .collection("settings")
      .doc("interestRates")
      .get();
    if (settingsDoc.exists) {
      const settings = settingsDoc.data();
      interestRateAnnual = settings.baseRate || interestRateAnnual;
      minBalance = settings.minBalance || minBalance;
    }
  } catch (error) {
    console.log(
      "Error fetching interest rate settings, using defaults:",
      error
    );
  }

  // Calculate daily rate from annual rate
  const dailyRate = interestRateAnnual / 365;

  // Get the user's wallet
  const walletRef = db.collection("wallets").doc(userId);
  const walletDoc = await walletRef.get();

  if (!walletDoc.exists) {
    return { success: false, message: "User wallet not found" };
  }

  const walletData = walletDoc.data();
  const balance = walletData.balance || 0;

  // Check if balance meets the minimum requirement
  if (balance <= minBalance) {
    return {
      success: false,
      message: `Wallet balance (${balance}) does not meet minimum requirement (${minBalance})`,
    };
  }

  // Calculate interest amount
  const interestAmount = balance * dailyRate;
  // Round to 2 decimal places
  const roundedInterest = Math.round(interestAmount * 100) / 100;

  if (roundedInterest <= 0) {
    return {
      success: false,
      message: "Calculated interest amount is zero or negative",
    };
  }

  // Update wallet balance
  await walletRef.update({
    balance: admin.firestore.FieldValue.increment(roundedInterest),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Create transaction record
  await db.collection("transactions").add({
    userId: userId,
    type: "deposit",
    category: "interest",
    amount: roundedInterest,
    description: "Daily interest payment",
    status: "completed",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Create interest history record
  await db.collection("interestHistory").add({
    userId: userId,
    amount: roundedInterest,
    rate: dailyRate,
    annualRate: interestRateAnnual,
    description: "Daily interest",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    previousBalance: balance,
    newBalance: balance + roundedInterest,
  });

  return {
    success: true,
    interest: roundedInterest,
    previousBalance: balance,
    newBalance: balance + roundedInterest,
    dailyRate: dailyRate,
    annualRate: interestRateAnnual,
  };
}
