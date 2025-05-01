const functions = require("firebase-functions");
const admin = require("firebase-admin");

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * Cloud Function to check for products back in stock and notify users who have subscribed
 * This function is scheduled to run every hour
 */
exports.checkProductsBackInStock = functions.pubsub
  .schedule("every 1 hours")
  .onRun(async (context) => {
    try {
      console.log("Checking for back in stock products...");

      // Get all stock notification subscriptions that haven't been notified yet
      const notificationsRef = db.collection("stockNotifications");
      const snapshot = await notificationsRef
        .where("notified", "==", false)
        .get();

      if (snapshot.empty) {
        console.log("No pending stock notifications found.");
        return null;
      }

      console.log(`Found ${snapshot.size} pending stock notifications.`);
      const batch = db.batch();
      let notifiedCount = 0;

      for (const doc of snapshot.docs) {
        const notification = doc.data();

        // Check product stock
        const productRef = db
          .collection("products")
          .doc(notification.productId);
        const productDoc = await productRef.get();

        if (!productDoc.exists) {
          // Product no longer exists, delete notification
          batch.delete(doc.ref);
          console.log(
            `Deleted notification for non-existent product: ${notification.productId}`
          );
          continue;
        }

        const productData = productDoc.data();

        let isInStock = false;

        if (notification.variantId) {
          // Check variant stock
          const variant = (productData.variants || []).find(
            (v) => v.id === notification.variantId
          );

          isInStock = variant && variant.stockQuantity > 0;
        } else {
          // Check main product stock
          isInStock =
            (productData.trackInventory && productData.stockQuantity > 0) ||
            !productData.trackInventory;
        }

        if (isInStock) {
          // Product is back in stock, notify user
          const notificationId = admin
            .firestore()
            .collection("notifications")
            .doc().id;
          batch.set(db.collection("notifications").doc(notificationId), {
            userId: notification.userId,
            type: "product_stock",
            title: "Product Back in Stock",
            message: `${productData.name} is now back in stock!`,
            link: `/product/${notification.productId}`,
            read: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          // Mark notification as sent
          batch.update(doc.ref, {
            notified: true,
            notifiedAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          notifiedCount++;
          console.log(
            `Created back-in-stock notification for user ${notification.userId} for product ${notification.productId}`
          );
        }
      }

      // Commit all changes in a batch
      await batch.commit();
      console.log(
        `Successfully processed ${notifiedCount} back-in-stock notifications.`
      );

      return null;
    } catch (error) {
      console.error("Error in checkProductsBackInStock:", error);
      return null;
    }
  });

/**
 * Cloud Function to check inventory levels daily and send alerts for low stock
 * Also handles automated reordering for eligible products
 */
exports.checkLowStockLevels = functions.pubsub
  .schedule("every day 00:00")
  .timeZone("UTC")
  .onRun(async (context) => {
    console.log("Checking for low stock inventory levels...");

    try {
      // Get all products that track inventory
      const productsRef = db.collection("products");
      const productsSnapshot = await productsRef
        .where("trackInventory", "==", true)
        .get();

      if (productsSnapshot.empty) {
        console.log("No products with inventory tracking found.");
        return null;
      }

      console.log(
        `Found ${productsSnapshot.size} products with inventory tracking.`
      );

      const batch = db.batch();
      let lowStockCount = 0;
      let reorderedCount = 0;

      // Process each product
      for (const productDoc of productsSnapshot.docs) {
        const productData = productDoc.data();
        const productId = productDoc.id;

        // Check if stock is below threshold
        const stockQuantity = productData.stockQuantity || 0;
        const lowStockThreshold = productData.lowStockThreshold || 5; // Default threshold of 5
        const isLowStock = stockQuantity <= lowStockThreshold;

        // If product has variants, check each variant's stock level
        if (productData.hasVariants && Array.isArray(productData.variants)) {
          for (const variant of productData.variants) {
            if (variant.trackInventory) {
              const variantStockQuantity = variant.stockQuantity || 0;
              const variantThreshold =
                variant.lowStockThreshold || lowStockThreshold;
              const isVariantLowStock =
                variantStockQuantity <= variantThreshold;

              if (isVariantLowStock) {
                // Create low stock alert for this variant
                await createLowStockAlert(
                  productData,
                  variant.id,
                  variantStockQuantity,
                  variantThreshold
                );
                lowStockCount++;

                // Check if this variant has auto-reordering enabled
                if (variant.autoReorder && !variant.reorderInProgress) {
                  await processAutoReorder(productData, variant.id, batch);
                  reorderedCount++;
                }
              }
            }
          }
        }

        // Check main product stock level (for products without variants)
        if (isLowStock && !productData.hasVariants) {
          // Create low stock alert
          await createLowStockAlert(
            productData,
            null,
            stockQuantity,
            lowStockThreshold
          );
          lowStockCount++;

          // Check if auto-reordering is enabled for this product
          if (productData.autoReorder && !productData.reorderInProgress) {
            await processAutoReorder(productData, null, batch);
            reorderedCount++;
          }
        }
      }

      // Commit the batch
      await batch.commit();

      console.log(
        `Processed ${lowStockCount} low stock alerts and initiated ${reorderedCount} automated reorders.`
      );
      return null;
    } catch (error) {
      console.error("Error checking low stock levels:", error);
      return null;
    }
  });

/**
 * Helper function to create a low stock alert notification for admins
 */
async function createLowStockAlert(
  productData,
  variantId,
  currentStock,
  threshold
) {
  try {
    // Create notification in the system
    const alertData = {
      type: "LOW_STOCK_ALERT",
      productId: productData.id,
      productName: productData.name,
      currentStock: currentStock,
      threshold: threshold,
      variantId: variantId,
      variantName: variantId
        ? productData.variants.find((v) => v.id === variantId)?.name ||
          "Unknown variant"
        : null,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      status: "new",
    };

    // Add to low stock alerts collection
    await db.collection("lowStockAlerts").add(alertData);

    // Find admin users to notify
    const adminsSnapshot = await db
      .collection("users")
      .where("roles", "array-contains", "admin")
      .get();

    // Send notification to each admin
    for (const adminDoc of adminsSnapshot.docs) {
      const adminId = adminDoc.id;

      const notificationData = {
        type: "LOW_STOCK_ALERT",
        title: "Low Stock Alert",
        message: variantId
          ? `${productData.name} (${alertData.variantName}) is running low: ${currentStock} units left`
          : `${productData.name} is running low: ${currentStock} units left`,
        productId: productData.id,
        variantId: variantId,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        read: false,
      };

      // Add to admin's notifications
      await db
        .collection("notifications")
        .doc(adminId)
        .collection("userNotifications")
        .add(notificationData);

      // Increment unread count
      await db
        .collection("notifications")
        .doc(adminId)
        .set(
          {
            unreadCount: admin.firestore.FieldValue.increment(1),
          },
          { merge: true }
        );
    }

    return { success: true };
  } catch (error) {
    console.error("Error creating low stock alert:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Helper function to process automatic reordering for products
 */
async function processAutoReorder(productData, variantId, batch) {
  try {
    // Determine which object to work with (main product or specific variant)
    const item = variantId
      ? productData.variants.find((v) => v.id === variantId)
      : productData;

    if (!item) {
      console.error(
        `Variant ${variantId} not found for product ${productData.id}`
      );
      return { success: false, error: "Item not found" };
    }

    // Get reorder quantity and supplier information
    const reorderQuantity = item.reorderQuantity || 50; // Default reorder quantity
    const supplierId =
      item.preferredSupplierId || productData.preferredSupplierId;

    // Create a purchase order
    const purchaseOrderData = {
      productId: productData.id,
      productName: productData.name,
      variantId: variantId,
      variantName: variantId
        ? productData.variants.find((v) => v.id === variantId)?.name ||
          "Unknown variant"
        : null,
      quantity: reorderQuantity,
      supplierId: supplierId,
      status: "pending",
      autoGenerated: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    // Add to purchase orders collection
    const purchaseOrderRef = await db
      .collection("purchaseOrders")
      .add(purchaseOrderData);

    // Update product/variant to mark reordering in progress
    if (variantId) {
      // For variant, we need to update the specific variant in the array
      const productRef = db.collection("products").doc(productData.id);
      const updatedVariants = productData.variants.map((v) => {
        if (v.id === variantId) {
          return {
            ...v,
            reorderInProgress: true,
            lastReorderDate: admin.firestore.FieldValue.serverTimestamp(),
            lastPurchaseOrderId: purchaseOrderRef.id,
          };
        }
        return v;
      });

      batch.update(productRef, {
        variants: updatedVariants,
      });
    } else {
      // For main product, update the document directly
      const productRef = db.collection("products").doc(productData.id);
      batch.update(productRef, {
        reorderInProgress: true,
        lastReorderDate: admin.firestore.FieldValue.serverTimestamp(),
        lastPurchaseOrderId: purchaseOrderRef.id,
      });
    }

    // If we have a supplier, send notification to them as well
    if (supplierId) {
      // Get supplier information
      const supplierDoc = await db
        .collection("suppliers")
        .doc(supplierId)
        .get();

      if (supplierDoc.exists) {
        const supplierData = supplierDoc.data();
        const supplierEmail = supplierData.email;

        // If supplier has a user account, send in-app notification
        if (supplierData.userId) {
          const notificationData = {
            type: "NEW_PURCHASE_ORDER",
            title: "New Purchase Order",
            message: variantId
              ? `New order for ${productData.name} (${purchaseOrderData.variantName}): ${reorderQuantity} units`
              : `New order for ${productData.name}: ${reorderQuantity} units`,
            poId: purchaseOrderRef.id,
            productId: productData.id,
            quantity: reorderQuantity,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            read: false,
          };

          await db
            .collection("notifications")
            .doc(supplierData.userId)
            .collection("userNotifications")
            .add(notificationData);

          await db
            .collection("notifications")
            .doc(supplierData.userId)
            .set(
              {
                unreadCount: admin.firestore.FieldValue.increment(1),
              },
              { merge: true }
            );
        }
      }
    }

    return { success: true, purchaseOrderId: purchaseOrderRef.id };
  } catch (error) {
    console.error("Error processing auto reorder:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Cloud Function to handle purchase order status updates
 * Updates inventory when orders are received
 */
exports.processPurchaseOrderUpdate = functions.firestore
  .document("purchaseOrders/{purchaseOrderId}")
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    const purchaseOrderId = context.params.purchaseOrderId;

    // Check if status changed to "received"
    if (before.status !== "received" && after.status === "received") {
      try {
        // Get the product
        const productRef = db.collection("products").doc(after.productId);
        const productDoc = await productRef.get();

        if (!productDoc.exists) {
          console.log(
            `Product ${after.productId} not found for purchase order ${purchaseOrderId}`
          );
          return null;
        }

        const productData = productDoc.data();

        // Update inventory based on received order
        if (after.variantId) {
          // Update variant inventory
          const variants = productData.variants || [];
          const updatedVariants = variants.map((variant) => {
            if (variant.id === after.variantId) {
              return {
                ...variant,
                stockQuantity: (variant.stockQuantity || 0) + after.quantity,
                reorderInProgress: false,
              };
            }
            return variant;
          });

          await productRef.update({
            variants: updatedVariants,
          });
        } else {
          // Update main product inventory
          await productRef.update({
            stockQuantity: admin.firestore.FieldValue.increment(after.quantity),
            reorderInProgress: false,
          });
        }

        console.log(
          `Updated inventory for ${after.productName} from purchase order ${purchaseOrderId}`
        );
        return { success: true };
      } catch (error) {
        console.error("Error processing purchase order update:", error);
        return null;
      }
    }

    return null;
  });

/**
 * Cloud Function that checks if products with subscribers are back in stock
 * and sends notifications to the subscribers.
 *
 * This function is triggered by Firestore updates to product inventory.
 */
exports.notifyForBackInStock = functions.firestore
  .document("products/{productId}")
  .onUpdate(async (change, context) => {
    const productId = context.params.productId;
    const beforeData = change.before.data();
    const afterData = change.after.data();

    // Check if product went from out of stock to in stock
    if (!beforeData.inStock && afterData.inStock) {
      try {
        const db = admin.firestore();

        // Get the product details
        const productSnapshot = await db
          .collection("products")
          .doc(productId)
          .get();
        const productData = productSnapshot.data();

        // If the product doesn't have variants, notify for the main product
        if (!productData.hasVariants) {
          await notifySubscribers(productId, null, productData);
        } else {
          // Check variants
          const variantsRef = db
            .collection("products")
            .doc(productId)
            .collection("variants");

          const variantsSnapshot = await variantsRef.get();

          // Process each variant
          const notifications = [];
          variantsSnapshot.forEach((variantDoc) => {
            const variantId = variantDoc.id;
            const variantData = variantDoc.data();

            // Check if variant went from out of stock to in stock
            if (
              variantData.inStock &&
              (!beforeData.variants ||
                !beforeData.variants[variantId] ||
                !beforeData.variants[variantId].inStock)
            ) {
              notifications.push(
                notifySubscribers(productId, variantId, {
                  ...productData,
                  variant: variantData,
                })
              );
            }
          });

          await Promise.all(notifications);
        }

        return { success: true };
      } catch (error) {
        console.error("Error in notifyForBackInStock function:", error);
        return { error: error.message };
      }
    }

    return { success: true, noChange: true };
  });

/**
 * Helper function to notify subscribers when a product is back in stock
 */
async function notifySubscribers(productId, variantId, productData) {
  try {
    const db = admin.firestore();

    // Query for subscribers to this product/variant
    const query = db
      .collection("stockNotifications")
      .where("productId", "==", productId)
      .where("notified", "==", false);

    // Add variant filter if needed
    const finalQuery = variantId
      ? query.where("variantId", "==", variantId)
      : query.where("variantId", "==", null);

    const subscribersSnapshot = await finalQuery.get();

    if (subscribersSnapshot.empty) {
      return { success: true, notifiedCount: 0 };
    }

    // Notify each subscriber
    const notificationPromises = [];

    subscribersSnapshot.forEach((doc) => {
      const subscriberData = doc.data();
      const userId = subscriberData.userId;

      // Create notification
      const productName = productData.name || "A product you wanted";
      const notificationData = {
        type: "PRODUCT_BACK_IN_STOCK",
        title: "Product Back in Stock!",
        message: `${productName} is now back in stock and available for purchase.`,
        productId,
        variantId,
        productName: productData.name,
        productImage:
          productData.images && productData.images.length > 0
            ? productData.images[0]
            : null,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        read: false,
      };

      // Add notification to the user's notifications collection
      const notificationPromise = db
        .collection("notifications")
        .doc(userId)
        .collection("userNotifications")
        .add(notificationData)
        .then(() => {
          // Increment unread count
          return db
            .collection("notifications")
            .doc(userId)
            .set(
              {
                unreadCount: admin.firestore.FieldValue.increment(1),
              },
              { merge: true }
            );
        })
        .then(() => {
          // Mark stock notification as sent
          return db.collection("stockNotifications").doc(doc.id).update({
            notified: true,
            notifiedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        });

      notificationPromises.push(notificationPromise);
    });

    await Promise.all(notificationPromises);

    return {
      success: true,
      notifiedCount: subscribersSnapshot.size,
    };
  } catch (error) {
    console.error("Error notifying subscribers:", error);
    return { success: false, error: error.message };
  }
}
