const functions = require("firebase-functions");
const admin = require("firebase-admin");

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * Schedule function to calculate and add daily interest to user wallets
 * Runs once per day at midnight (server time)
 *
 * Interest rate is configurable - default is 0.01% daily (approximately 3.65% annual)
 */
exports.calculateDailyInterest = functions.pubsub
  .schedule("0 0 * * *") // Run at midnight every day (cron syntax)
  .timeZone("UTC")
  .onRun(async (context) => {
    console.log("Starting daily interest calculation...");

    try {
      // Get current interest rate configuration
      const settingsRef = db.collection("systemSettings").doc("interestRates");
      const settingsDoc = await settingsRef.get();

      // Default values if no settings found
      let DAILY_INTEREST_RATE = 0.0001; // 0.01% daily interest
      let MIN_BALANCE_FOR_INTEREST = 100; // Minimum balance to earn interest

      if (settingsDoc.exists) {
        const settings = settingsDoc.data();
        DAILY_INTEREST_RATE = settings.dailyRate || DAILY_INTEREST_RATE;
        MIN_BALANCE_FOR_INTEREST =
          settings.minBalance || MIN_BALANCE_FOR_INTEREST;
      }

      // Get all users
      const usersRef = db.collection("users");
      const snapshot = await usersRef.get();

      if (snapshot.empty) {
        console.log("No users found with wallets.");
        return null;
      }

      const batch = db.batch();
      const timestamp = admin.firestore.FieldValue.serverTimestamp();
      let userCount = 0;
      let totalInterestPaid = 0;

      // Process each user
      for (const userDoc of snapshot.docs) {
        const userData = userDoc.data();

        // Skip users without wallets or with balances below minimum
        if (
          !userData.wallet ||
          userData.wallet.balance < MIN_BALANCE_FOR_INTEREST
        ) {
          continue;
        }

        // Calculate interest amount
        const balance = userData.wallet.balance;
        const interestAmount = Math.floor(balance * DAILY_INTEREST_RATE); // Round down to integer

        // Skip if interest amount is zero
        if (interestAmount <= 0) {
          continue;
        }

        // Update user's wallet with interest
        const userRef = db.collection("users").doc(userDoc.id);
        batch.update(userRef, {
          "wallet.balance":
            admin.firestore.FieldValue.increment(interestAmount),
          "wallet.lastUpdated": timestamp,
        });

        // Record the interest transaction
        const transactionRef = db.collection("transactions").doc();
        batch.set(transactionRef, {
          userId: userDoc.id,
          type: "credit",
          amount: interestAmount,
          description: "Daily interest payment",
          category: "interest",
          status: "completed",
          createdAt: timestamp,
        });

        userCount++;
        totalInterestPaid += interestAmount;
      }

      // Commit the batch if we have operations
      if (userCount > 0) {
        await batch.commit();
        console.log(
          `Interest paid to ${userCount} users. Total interest: ${totalInterestPaid}`
        );

        // Create an audit log entry
        await db.collection("systemLogs").add({
          type: "interestPayment",
          userCount,
          totalInterestPaid,
          interestRate: DAILY_INTEREST_RATE,
          timestamp,
        });
      } else {
        console.log("No eligible users for interest payment.");
      }

      return null;
    } catch (error) {
      console.error("Error calculating daily interest:", error);
      throw error;
    }
  });

/**
 * HTTP Function to manually trigger interest calculation (for testing or admin use)
 * Protected by authentication - only admin users can trigger this
 */
exports.manuallyTriggerInterestCalculation = functions.https.onCall(
  async (data, context) => {
    // Check if the user is authenticated and has admin role
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "You must be signed in to trigger interest calculation"
      );
    }

    try {
      // Check if user is an admin
      const userRef = db.collection("users").doc(context.auth.uid);
      const userDoc = await userRef.get();

      if (!userDoc.exists) {
        throw new functions.https.HttpsError("not-found", "User not found");
      }

      const userData = userDoc.data();
      const roles = userData.roles || [];

      // Verify admin role
      if (!Array.isArray(roles) || !roles.includes("admin")) {
        throw new functions.https.HttpsError(
          "permission-denied",
          "You must be an admin to trigger interest calculation"
        );
      }

      // Get the interest rate from the request or use default
      const interestRate = data?.interestRate || 0.0001;
      const minBalance = data?.minBalance || 100;

      // Process the interest calculation
      const usersRef = db.collection("users");
      const snapshot = await usersRef.get();

      if (snapshot.empty) {
        return {
          success: true,
          message: "No users found with wallets.",
          usersUpdated: 0,
        };
      }

      const batch = db.batch();
      const timestamp = admin.firestore.FieldValue.serverTimestamp();
      let userCount = 0;
      let totalInterestPaid = 0;

      // Process each user
      for (const userDoc of snapshot.docs) {
        const userData = userDoc.data();

        // Skip users without wallets or with balances below minimum
        if (!userData.wallet || userData.wallet.balance < minBalance) {
          continue;
        }

        // Calculate interest amount
        const balance = userData.wallet.balance;
        const interestAmount = Math.floor(balance * interestRate); // Round down to integer

        // Skip if interest amount is zero
        if (interestAmount <= 0) {
          continue;
        }

        // Update user's wallet with interest
        const userRef = db.collection("users").doc(userDoc.id);
        batch.update(userRef, {
          "wallet.balance":
            admin.firestore.FieldValue.increment(interestAmount),
          "wallet.lastUpdated": timestamp,
        });

        // Record the transaction
        const transactionRef = db.collection("transactions").doc();
        batch.set(transactionRef, {
          userId: userDoc.id,
          type: "credit",
          amount: interestAmount,
          description: "Manual interest payment",
          category: "interest",
          status: "completed",
          createdAt: timestamp,
          triggeredBy: context.auth.uid,
        });

        userCount++;
        totalInterestPaid += interestAmount;
      }

      // Commit the batch if we have operations
      if (userCount > 0) {
        await batch.commit();

        // Create an audit log entry
        await db.collection("systemLogs").add({
          type: "manualInterestPayment",
          userCount,
          totalInterestPaid,
          interestRate,
          adminId: context.auth.uid,
          timestamp,
        });
      }

      return {
        success: true,
        usersUpdated: userCount,
        totalInterestPaid,
        message:
          userCount > 0
            ? `Interest paid to ${userCount} users. Total interest: ${totalInterestPaid}`
            : "No eligible users for interest payment.",
      };
    } catch (error) {
      console.error("Error in manual interest calculation:", error);
      throw new functions.https.HttpsError("internal", error.message);
    }
  }
);
