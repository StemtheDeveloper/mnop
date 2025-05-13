const functions = require("firebase-functions");
const admin = require("firebase-admin");

// Firebase Admin is initialized in index.js
const db = admin.firestore();

/**
 * Cloud Function that runs daily to check products that have hit their deadline
 * and haven't reached their funding goal, then archives them and notifies designers
 */
exports.checkProductDeadlines = functions.pubsub
  .schedule("0 0 * * *") // Run at midnight every day (cron syntax)
  .timeZone("UTC")
  .onRun(async (context) => {
    console.log("Starting daily product deadline check...");

    try {
      const now = admin.firestore.Timestamp.now();

      // Query products where:
      // 1. Deadline has passed (deadline < now)
      // 2. Status is still active
      // 3. Current funding is less than funding goal
      const productsRef = db.collection("products");
      const snapshot = await productsRef
        .where("deadline", "<=", now)
        .where("status", "==", "active")
        .get();

      if (snapshot.empty) {
        console.log("No products have hit their deadline today");
        return null;
      }

      console.log(`Found ${snapshot.size} products to check for archiving`);
      const batch = db.batch();
      const notifications = [];
      let archivedCount = 0;

      // Process each product
      for (const doc of snapshot.docs) {
        const product = doc.data();

        // Check if funding goal was met
        const currentFunding = product.currentFunding || 0;
        const fundingGoal = product.fundingGoal || 0;

        if (currentFunding < fundingGoal) {
          console.log(
            `Product ${doc.id} did not meet funding goal (${currentFunding}/${fundingGoal}), archiving...`
          );

          // Update product status to archived
          batch.update(doc.ref, {
            status: "archived",
            archivedAt: admin.firestore.FieldValue.serverTimestamp(),
            archived: true,
            archiveReason: "funding_goal_not_met",
          });

          // Create notification for designer
          const designerId = product.designerId;
          if (designerId) {
            const notificationRef = db.collection("notifications").doc();
            const notification = {
              userId: designerId,
              title: "Product Archived: Funding Goal Not Met",
              message: `Your product "${product.name}" has been archived because it did not meet its funding goal of ${fundingGoal} by the deadline.`,
              productId: doc.id,
              productName: product.name,
              type: "product_archived",
              read: false,
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
            };

            notifications.push({ ref: notificationRef, data: notification });
          }

          archivedCount++;
        }
      }

      // Only commit if we have changes to make
      if (archivedCount > 0) {
        // Add notifications to batch
        notifications.forEach((item) => {
          batch.set(item.ref, item.data);
        });

        // Commit all changes
        await batch.commit();

        // Create a system log entry
        await db.collection("systemLogs").add({
          type: "productArchiving",
          productsArchived: archivedCount,
          notificationsSent: notifications.length,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });

        console.log(
          `Successfully archived ${archivedCount} products and sent ${notifications.length} notifications`
        );
      } else {
        console.log("No products needed archiving");
      }

      return null;
    } catch (error) {
      console.error("Error checking product deadlines:", error);
      throw error;
    }
  });

/**
 * HTTP Function to manually trigger deadline checking (for testing or admin use)
 * Protected by authentication - only admin users can trigger this
 */
exports.manuallyCheckProductDeadlines = functions.https.onCall(
  async (data, context) => {
    // Check if the user is authenticated and has admin role
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "You must be signed in to trigger product deadline check"
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
          "You must be an admin to trigger product deadline check"
        );
      }

      // Get the override date if provided
      const overrideDate = data?.overrideDate
        ? new Date(data.overrideDate)
        : null;
      const timestamp = overrideDate
        ? admin.firestore.Timestamp.fromDate(overrideDate)
        : admin.firestore.Timestamp.now();

      // Process products
      const productsRef = db.collection("products");
      const snapshot = await productsRef
        .where("deadline", "<=", timestamp)
        .where("status", "==", "active")
        .get();

      if (snapshot.empty) {
        return {
          success: true,
          message: "No products have hit their deadline to check",
          processed: 0,
          archived: 0,
        };
      }

      const batch = db.batch();
      const notifications = [];
      let processed = 0;
      let archived = 0;

      // Process each product
      for (const doc of snapshot.docs) {
        const product = doc.data();
        processed++;

        // Check if funding goal was met
        const currentFunding = product.currentFunding || 0;
        const fundingGoal = product.fundingGoal || 0;

        if (currentFunding < fundingGoal) {
          // Update product status to archived
          batch.update(doc.ref, {
            status: "archived",
            archivedAt: admin.firestore.FieldValue.serverTimestamp(),
            archived: true,
            archiveReason: "funding_goal_not_met",
            archivedBy: context.auth.uid,
          });

          // Create notification for designer
          const designerId = product.designerId;
          if (designerId) {
            const notificationRef = db.collection("notifications").doc();
            const notification = {
              userId: designerId,
              title: "Product Archived: Funding Goal Not Met",
              message: `Your product "${product.name}" has been archived because it did not meet its funding goal of ${fundingGoal} by the deadline.`,
              productId: doc.id,
              productName: product.name,
              type: "product_archived",
              read: false,
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
              triggeredBy: context.auth.uid,
            };

            notifications.push({ ref: notificationRef, data: notification });
          }

          archived++;
        }
      }

      // Only commit if we have changes to make
      if (archived > 0) {
        // Add notifications to batch
        notifications.forEach((item) => {
          batch.set(item.ref, item.data);
        });

        // Commit all changes
        await batch.commit();

        // Create a system log entry
        await db.collection("systemLogs").add({
          type: "manualProductArchiving",
          productsArchived: archived,
          productsProcessed: processed,
          notificationsSent: notifications.length,
          adminId: context.auth.uid,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      return {
        success: true,
        message: `Successfully checked ${processed} products. Archived ${archived} products that didn't meet funding goals.`,
        processed,
        archived,
        notificationsSent: notifications.length,
      };
    } catch (error) {
      console.error("Error in manual product deadline check:", error);
      throw new functions.https.HttpsError("internal", error.message);
    }
  }
);
