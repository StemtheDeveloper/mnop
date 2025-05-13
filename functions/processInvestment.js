const functions = require("firebase-functions");
const admin = require("firebase-admin");

// Firebase Admin is initialized in index.js
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
    const roles = Array.isArray(userData.roles)
      ? userData.roles
      : userData.role
      ? [userData.role]
      : ["customer"];

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
    const designerId = productData.designerId;

    if (!designerId) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Invalid product data: missing designer ID"
      );
    }

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
      // First, get the wallet document
      const walletRef = db.collection("wallets").doc(userId);
      const walletDoc = await transaction.get(walletRef);

      if (!walletDoc.exists) {
        throw new functions.https.HttpsError(
          "failed-precondition",
          "Wallet not found"
        );
      }

      const walletData = walletDoc.data();
      const currentBalance = walletData.balance || 0;

      if (currentBalance < amount) {
        throw new functions.https.HttpsError(
          "failed-precondition",
          "Insufficient funds in wallet"
        );
      }

      // Update user wallet - deduct amount
      transaction.update(walletRef, {
        balance: admin.firestore.FieldValue.increment(-amount),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Record transaction for the investment
      const transactionRef = db.collection("transactions").doc();
      transaction.set(transactionRef, {
        userId,
        type: "investment",
        amount: -amount,
        description: `Investment in ${
          productName || productData.name || "product"
        }`,
        productId,
        status: "completed",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Update product funding progress
      transaction.update(productRef, {
        currentFunding: admin.firestore.FieldValue.increment(amount),
        investorCount: admin.firestore.FieldValue.increment(1),
        lastFundedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Create investment record
      const investmentRef = db.collection("investments").doc();
      const investmentData = {
        userId,
        productId,
        designerId,
        productName: productName || productData.name,
        amount,
        status: "active",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      transaction.set(investmentRef, investmentData);

      // Create notifications for both investor and designer
      const investorNotificationRef = db.collection("notifications").doc();
      transaction.set(investorNotificationRef, {
        userId: userId,
        type: "investment",
        title: "Investment Successful",
        message: `You've successfully invested $${amount} in ${
          productName || productData.name
        }`,
        link: `/product/${productId}`,
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Notify the designer about the investment
      const designerNotificationRef = db.collection("notifications").doc();

      // First get the investor's name (or email as fallback)
      const investorName =
        userData.displayName || userData.email || "An investor";

      transaction.set(designerNotificationRef, {
        userId: designerId,
        type: "investment",
        title: "New Investment",
        message: `${investorName} has invested $${amount} in your product "${
          productName || productData.name
        }"`,
        link: `/product/${productId}`,
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return {
        success: true,
        investmentId: investmentRef.id,
        fundingProgress: (productData.currentFunding || 0) + amount,
        message: `Successfully invested ${amount} in ${
          productName || productData.name || "product"
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

/**
 * Helper function to create an investment record
 * This is exported separately so it can be called from other functions
 */
exports.createInvestmentRecord = async (
  userId,
  productId,
  amount,
  productName
) => {
  try {
    // Get user data
    const userRef = db.collection("users").doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      throw new Error("User not found");
    }

    // Get product data
    const productRef = db.collection("products").doc(productId);
    const productDoc = await productRef.get();

    if (!productDoc.exists) {
      throw new Error("Product not found");
    }

    const productData = productDoc.data();
    const designerId = productData.designerId;

    // Create investment record
    const investmentRef = db.collection("investments").doc();
    await investmentRef.set({
      userId,
      productId,
      designerId,
      productName: productName || productData.name,
      amount,
      status: "active",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {
      success: true,
      investmentId: investmentRef.id,
    };
  } catch (error) {
    console.error("Error creating investment record:", error);
    throw error;
  }
};
