const functions = require("firebase-functions");
const admin = require("firebase-admin");

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * Cloud Function to process an investment transaction
 * This handles the transaction between the investor's wallet and the product funding
 *
 * Required data:
 * - userId: string - ID of the investor
 * - productId: string - ID of the product being invested in
 * - amount: number - Investment amount
 * - productName: string - Name of the product (for transaction record)
 */
exports.processInvestment = functions.https.onCall(async (data, context) => {
  // Ensure the user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "You must be signed in to make investments"
    );
  }

  try {
    const { userId, productId, amount, productName } = data;

    // Validate inputs
    if (!userId || !productId || !amount || amount <= 0) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Invalid investment parameters"
      );
    }

    // Ensure the caller is the user making the investment
    if (context.auth.uid !== userId) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "You can only make investments for yourself"
      );
    }

    // Check if user has investor role
    const userRef = db.collection("users").doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      throw new functions.https.HttpsError("not-found", "User not found");
    }

    const userData = userDoc.data();
    const roles = userData.roles || [userData.role || "customer"];

    if (!Array.isArray(roles)) {
      throw new functions.https.HttpsError(
        "internal",
        "Invalid user role format"
      );
    }

    if (!roles.includes("investor")) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "You need investor role to make investments"
      );
    }

    // Get the product
    const productRef = db.collection("products").doc(productId);
    const productDoc = await productRef.get();

    if (!productDoc.exists) {
      throw new functions.https.HttpsError("not-found", "Product not found");
    }

    const productData = productDoc.data();

    // Check if product is accepting investments
    if (
      productData.status !== "funding" &&
      productData.status !== "active" &&
      productData.status !== "open"
    ) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "This product is not currently accepting investments"
      );
    }

    // Use a Firestore transaction to ensure atomicity
    return await db.runTransaction(async (transaction) => {
      // Check wallet balance
      const freshUserDoc = await transaction.get(userRef);
      const freshUserData = freshUserDoc.data();

      if (!freshUserData.wallet || freshUserData.wallet.balance < amount) {
        throw new functions.https.HttpsError(
          "failed-precondition",
          "Insufficient funds in wallet"
        );
      }

      // Update user wallet
      transaction.update(userRef, {
        "wallet.balance": admin.firestore.FieldValue.increment(-amount),
        "wallet.lastUpdated": admin.firestore.FieldValue.serverTimestamp(),
      });

      // Record transaction
      const transactionRef = db.collection("transactions").doc();
      transaction.set(transactionRef, {
        userId,
        type: "debit",
        amount,
        description: `Investment in ${productName || "product"}`,
        status: "completed",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Update product funding progress
      transaction.update(productRef, {
        fundingProgress: admin.firestore.FieldValue.increment(amount),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Create investment record
      const investmentRef = db.collection("investments").doc();
      const investmentData = {
        userId,
        productId,
        productName: productName || productData.name,
        amount,
        status: "active",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        notes: "",
      };

      transaction.set(investmentRef, investmentData);

      return {
        success: true,
        investmentId: investmentRef.id,
        message: `Successfully invested ${amount} in ${
          productName || "product"
        }`,
      };
    });
  } catch (error) {
    console.error("Investment processing error:", error);

    throw new functions.https.HttpsError(
      "internal",
      error.message || "An error occurred while processing the investment"
    );
  }
});
