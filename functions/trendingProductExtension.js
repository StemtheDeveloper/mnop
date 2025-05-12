const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { onSchedule } = require("firebase-functions/v2/scheduler");

// Initialize admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * Function to check for trending products and extend their deadlines
 * A product is considered trending if it has high view count or investment activity
 */

exports.checkTrendingProducts = onSchedule(
  {
    schedule: "0 0 * * *", // daily midnight UTC
    timeZone: "UTC",
    cpu: 1,
    memory: "1GiB",
    timeoutSeconds: 300,
  },
  async (event) => {
    console.log("Starting daily trending products check...");

    try {
      const now = admin.firestore.Timestamp.now();

      // Get active products with deadlines coming up in the next 7 days
      const oneWeekFromNow = new Date();
      oneWeekFromNow.setDate(oneWeekFromNow.getDate() + 7);
      const oneWeekTimestamp =
        admin.firestore.Timestamp.fromDate(oneWeekFromNow);

      const productsRef = db.collection("products");
      const snapshot = await productsRef
        .where("status", "==", "active")
        .where("deadline", "<=", oneWeekTimestamp)
        .where("deadline", ">", now)
        .get();

      if (snapshot.empty) {
        console.log("No products with upcoming deadlines found");
        return null;
      }

      console.log(
        `Found ${snapshot.size} products with deadlines in the next 7 days`
      );

      // Define trending thresholds
      const VIEW_THRESHOLD = 50; // Views in the last week
      const INVESTMENT_THRESHOLD = 3; // Number of investments in the last week
      const INVESTMENT_AMOUNT_THRESHOLD = 1000; // Minimum investment amount in the last week
      const EXTENSION_DAYS = 7; // Extend by 7 days

      const batch = db.batch();
      const notifications = [];
      let extendedCount = 0;

      // Get timestamp for one week ago
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      const oneWeekAgoTimestamp =
        admin.firestore.Timestamp.fromDate(oneWeekAgo);

      // Process each product with upcoming deadline
      for (const doc of snapshot.docs) {
        const product = doc.data();
        const productId = doc.id;
        let shouldExtend = false;
        let extensionReason = [];

        // Check recent view count
        const viewsRef = db
          .collection("productViews")
          .where("productId", "==", productId)
          .where("timestamp", ">=", oneWeekAgoTimestamp);

        const viewsSnapshot = await viewsRef.get();
        const recentViews = viewsSnapshot.size;

        if (recentViews >= VIEW_THRESHOLD) {
          shouldExtend = true;
          extensionReason.push(`high view count (${recentViews})`);
        }

        // Check recent investments
        const investmentsRef = db
          .collection("investments")
          .where("productId", "==", productId)
          .where("createdAt", ">=", oneWeekAgoTimestamp)
          .where("status", "==", "completed");

        const investmentsSnapshot = await investmentsRef.get();
        const recentInvestments = investmentsSnapshot.size;

        if (recentInvestments > 0) {
          // Calculate total investment amount
          let totalInvestment = 0;
          investmentsSnapshot.forEach((doc) => {
            totalInvestment += doc.data().amount || 0;
          });

          if (
            recentInvestments >= INVESTMENT_THRESHOLD ||
            totalInvestment >= INVESTMENT_AMOUNT_THRESHOLD
          ) {
            shouldExtend = true;
            extensionReason.push(
              `recent investment activity (${recentInvestments} investments, $${totalInvestment})`
            );
          }
        }

        if (shouldExtend) {
          // Calculate new deadline (extend by EXTENSION_DAYS)
          let currentDeadline = product.deadline.toDate();
          let newDeadline = new Date(currentDeadline);
          newDeadline.setDate(newDeadline.getDate() + EXTENSION_DAYS);

          // Update product with extended deadline
          batch.update(doc.ref, {
            deadline: admin.firestore.Timestamp.fromDate(newDeadline),
            lastExtended: admin.firestore.FieldValue.serverTimestamp(),
            extensionHistory: admin.firestore.FieldValue.arrayUnion({
              previousDeadline: product.deadline,
              newDeadline: admin.firestore.Timestamp.fromDate(newDeadline),
              reason: extensionReason.join(", "),
              timestamp: admin.firestore.FieldValue.serverTimestamp(),
            }),
          });

          // Create notification for designer
          const designerId = product.designerId;
          if (designerId) {
            const notificationRef = db.collection("notifications").doc();
            const notification = {
              userId: designerId,
              title: "Product Deadline Extended",
              message: `Good news! Your product "${
                product.name
              }" is trending. The deadline has been automatically extended by ${EXTENSION_DAYS} days due to ${extensionReason.join(
                " and "
              )}.`,
              productId: productId,
              productName: product.name,
              type: "deadline_extended",
              read: false,
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
            };

            notifications.push({ ref: notificationRef, data: notification });
          }

          extendedCount++;
        }
      }

      // Only commit if we have changes to make
      if (extendedCount > 0) {
        // Add notifications to batch
        notifications.forEach((item) => {
          batch.set(item.ref, item.data);
        });

        // Commit all changes
        await batch.commit();

        // Create a system log entry
        await db.collection("systemLogs").add({
          type: "productDeadlineExtension",
          productsExtended: extendedCount,
          notificationsSent: notifications.length,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });

        console.log(
          `Successfully extended deadlines for ${extendedCount} trending products`
        );
      } else {
        console.log("No trending products found that needed extension");
      }

      return null;
    } catch (error) {
      console.error("Error checking trending products:", error);
      throw error;
    }
  }
);

/**
 * HTTP callable function for designers to request a deadline extension for trending products
 */
exports.requestDeadlineExtension = functions.https.onCall(
  async (data, context) => {
    // Check if user is authenticated
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "You must be signed in to request a deadline extension"
      );
    }

    const { productId } = data;
    if (!productId) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Product ID is required"
      );
    }

    try {
      const db = admin.firestore();

      // Get the product
      const productRef = db.collection("products").doc(productId);
      const productDoc = await productRef.get();

      if (!productDoc.exists) {
        throw new functions.https.HttpsError("not-found", "Product not found");
      }

      const productData = productDoc.data();

      // Check if user is the designer of the product
      if (productData.designerId !== context.auth.uid) {
        throw new functions.https.HttpsError(
          "permission-denied",
          "You must be the designer of the product to request an extension"
        );
      }

      // Check if product is active
      if (productData.status !== "active") {
        throw new functions.https.HttpsError(
          "failed-precondition",
          "Only active products can have their deadlines extended"
        );
      }

      // Check if deadline is in the future
      const now = admin.firestore.Timestamp.now();
      if (productData.deadline < now) {
        throw new functions.https.HttpsError(
          "failed-precondition",
          "The product deadline has already passed"
        );
      }

      // Define constants
      const EXTENSION_DAYS = 7; // Extend by 7 days
      const MAX_MANUAL_EXTENSIONS = 1; // Maximum number of manual extensions allowed

      // Check if product has already been manually extended too many times
      const manualExtensionCount = productData.manualExtensionCount || 0;
      if (manualExtensionCount >= MAX_MANUAL_EXTENSIONS) {
        throw new functions.https.HttpsError(
          "failed-precondition",
          `You've already extended this product ${MAX_MANUAL_EXTENSIONS} time(s)`
        );
      }

      // Check if this product meets trending criteria
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      const oneWeekAgoTimestamp =
        admin.firestore.Timestamp.fromDate(oneWeekAgo);

      // Define trend thresholds (lower than automatic since this is manual)
      const VIEW_THRESHOLD = 30;
      const INVESTMENT_THRESHOLD = 2;
      const INVESTMENT_AMOUNT_THRESHOLD = 500;

      // Check recent view count
      const viewsRef = db
        .collection("productViews")
        .where("productId", "==", productId)
        .where("timestamp", ">=", oneWeekAgoTimestamp);

      const viewsSnapshot = await viewsRef.get();
      const recentViews = viewsSnapshot.size;

      // Check recent investments
      const investmentsRef = db
        .collection("investments")
        .where("productId", "==", productId)
        .where("createdAt", ">=", oneWeekAgoTimestamp)
        .where("status", "==", "completed");

      const investmentsSnapshot = await investmentsRef.get();
      const recentInvestments = investmentsSnapshot.size;

      // Calculate total investment amount
      let totalInvestment = 0;
      investmentsSnapshot.forEach((doc) => {
        totalInvestment += doc.data().amount || 0;
      });

      // Check if it meets any trending criteria
      const hasTrendingViews = recentViews >= VIEW_THRESHOLD;
      const hasTrendingInvestments = recentInvestments >= INVESTMENT_THRESHOLD;
      const hasTrendingInvestmentAmount =
        totalInvestment >= INVESTMENT_AMOUNT_THRESHOLD;

      if (
        !hasTrendingViews &&
        !hasTrendingInvestments &&
        !hasTrendingInvestmentAmount
      ) {
        return {
          success: false,
          message:
            "Your product does not meet the trending criteria for a deadline extension",
          trendData: {
            views: {
              count: recentViews,
              threshold: VIEW_THRESHOLD,
              isTrending: hasTrendingViews,
            },
            investments: {
              count: recentInvestments,
              threshold: INVESTMENT_THRESHOLD,
              isTrending: hasTrendingInvestments,
            },
            investmentAmount: {
              amount: totalInvestment,
              threshold: INVESTMENT_AMOUNT_THRESHOLD,
              isTrending: hasTrendingInvestmentAmount,
            },
          },
        };
      }

      // Calculate new deadline (extend by EXTENSION_DAYS)
      let currentDeadline = productData.deadline.toDate();
      let newDeadline = new Date(currentDeadline);
      newDeadline.setDate(newDeadline.getDate() + EXTENSION_DAYS);

      // Build the reason string
      let extensionReasons = [];
      if (hasTrendingViews)
        extensionReasons.push(`high view count (${recentViews})`);
      if (hasTrendingInvestments || hasTrendingInvestmentAmount) {
        extensionReasons.push(
          `investment activity (${recentInvestments} investments, $${totalInvestment})`
        );
      }

      // Update the product
      await productRef.update({
        deadline: admin.firestore.Timestamp.fromDate(newDeadline),
        lastExtended: admin.firestore.FieldValue.serverTimestamp(),
        manualExtensionCount: admin.firestore.FieldValue.increment(1),
        extensionHistory: admin.firestore.FieldValue.arrayUnion({
          previousDeadline: productData.deadline,
          newDeadline: admin.firestore.Timestamp.fromDate(newDeadline),
          reason: `Manual extension due to ${extensionReasons.join(" and ")}`,
          requestedBy: context.auth.uid,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
        }),
      });

      // Create a system log entry
      await db.collection("systemLogs").add({
        type: "manualProductDeadlineExtension",
        productId,
        designerId: context.auth.uid,
        previousDeadline: productData.deadline,
        newDeadline: admin.firestore.Timestamp.fromDate(newDeadline),
        reasons: extensionReasons,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });

      return {
        success: true,
        message: `Successfully extended product deadline by ${EXTENSION_DAYS} days due to trending activity`,
        newDeadline: newDeadline.toISOString(),
        trendData: {
          views: {
            count: recentViews,
            threshold: VIEW_THRESHOLD,
            isTrending: hasTrendingViews,
          },
          investments: {
            count: recentInvestments,
            threshold: INVESTMENT_THRESHOLD,
            isTrending: hasTrendingInvestments,
          },
          investmentAmount: {
            amount: totalInvestment,
            threshold: INVESTMENT_AMOUNT_THRESHOLD,
            isTrending: hasTrendingInvestmentAmount,
          },
        },
      };
    } catch (error) {
      console.error("Error requesting deadline extension:", error);
      throw new functions.https.HttpsError("internal", error.message);
    }
  }
);
