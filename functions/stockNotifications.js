/****************************************************************************************
 * Stock & Inventory Cloud Functions
 * ──────────────────────────────────────────────────────────────────────────────────────
 *  • checkProductsBackInStock   – hourly cron, notifies users when items return to stock
 *  • checkLowStockLevels        – nightly cron, low-stock alerts + auto-reorders
 *  • processPurchaseOrderUpdate – Firestore update trigger, adds received stock
 *  • notifyForBackInStock       – Firestore update trigger, realtime back-in-stock notify
 ****************************************************************************************/

// ─── Imports & init ────────────────────────────────────────────────────────────────
const admin = require("firebase-admin");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onDocumentUpdated } = require("firebase-functions/v2/firestore");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

// ────────────────────────────────────────────────────────────────────────────────
// 1. HOURLY: notify subscribers when a product is back in stock
// ────────────────────────────────────────────────────────────────────────────────
exports.checkProductsBackInStock = onSchedule(
  {
    schedule: "0 * * * *",
    timeZone: "UTC",
    cpu: 1,
    memory: "1GiB",
    timeoutSeconds: 300,
  },
  async () => {
    try {
      console.log("Checking for back-in-stock products …");

      const pendingSnaps = await db
        .collection("stockNotifications")
        .where("notified", "==", false)
        .get();

      if (pendingSnaps.empty) {
        console.log("No pending stock notifications.");
        return;
      }

      console.log(`Found ${pendingSnaps.size} pending notifications.`);
      const batch = db.batch();
      let notifiedCount = 0;

      for (const notifDoc of pendingSnaps.docs) {
        const notif = notifDoc.data();
        const prodRef = db.collection("products").doc(notif.productId);
        const prodDoc = await prodRef.get();

        // Clean up deleted products
        if (!prodDoc.exists) {
          batch.delete(notifDoc.ref);
          continue;
        }

        const product = { ...prodDoc.data(), id: prodDoc.id };
        let inStock = false;

        if (notif.variantId) {
          const variant = (product.variants || []).find(
            (v) => v.id === notif.variantId
          );
          inStock = !!(variant && variant.stockQuantity > 0);
        } else {
          inStock =
            (product.trackInventory && product.stockQuantity > 0) ||
            !product.trackInventory;
        }

        if (inStock) {
          // user notification
          batch.set(db.collection("notifications").doc(), {
            userId: notif.userId,
            type: "PRODUCT_BACK_IN_STOCK",
            title: "Product Back in Stock",
            message: `${product.name} is now available!`,
            link: `/product/${product.id}`,
            read: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          batch.update(notifDoc.ref, {
            notified: true,
            notifiedAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          notifiedCount++;
        }
      }

      await batch.commit();
      console.log(`✔︎ Sent ${notifiedCount} notifications.`);
    } catch (err) {
      console.error("checkProductsBackInStock error:", err);
    }
  }
);

// ────────────────────────────────────────────────────────────────────────────────
// 2. NIGHTLY: low-stock check + optional auto-reorder
// ────────────────────────────────────────────────────────────────────────────────
exports.checkLowStockLevels = onSchedule(
  {
    schedule: "0 0 * * *",
    timeZone: "UTC",
    cpu: 1,
    memory: "1GiB",
    timeoutSeconds: 300,
  },
  async () => {
    console.log("Running low-stock check …");
    try {
      const prodSnap = await db
        .collection("products")
        .where("trackInventory", "==", true)
        .get();

      if (prodSnap.empty) return;

      const batch = db.batch();
      let lowStockAlerts = 0;
      let autoReorders = 0;

      for (const prodDoc of prodSnap.docs) {
        const product = { ...prodDoc.data(), id: prodDoc.id };
        const defaultThreshold = product.lowStockThreshold || 5;
        const mainQty = product.stockQuantity ?? 0;
        const mainLow = mainQty <= defaultThreshold;

        // ── Variants ──
        if (product.hasVariants && Array.isArray(product.variants)) {
          for (const variant of product.variants) {
            if (!variant.trackInventory) continue;

            const vQty = variant.stockQuantity ?? 0;
            const vTh = variant.lowStockThreshold ?? defaultThreshold;
            if (vQty <= vTh) {
              await createLowStockAlert(product, variant.id, vQty, vTh);
              lowStockAlerts++;

              if (variant.autoReorder && !variant.reorderInProgress) {
                await processAutoReorder(product, variant.id, batch);
                autoReorders++;
              }
            }
          }
        }

        // ── Main product ──
        if (!product.hasVariants && mainLow) {
          await createLowStockAlert(product, null, mainQty, defaultThreshold);
          lowStockAlerts++;

          if (product.autoReorder && !product.reorderInProgress) {
            await processAutoReorder(product, null, batch);
            autoReorders++;
          }
        }
      }

      await batch.commit();
      console.log(
        `✔︎ ${lowStockAlerts} alerts, ${autoReorders} auto-reorders.`
      );
    } catch (err) {
      console.error("checkLowStockLevels error:", err);
    }
  }
);

// ────────────────────────────────────────────────────────────────────────────────
// Helper: create admin low-stock alert
// ────────────────────────────────────────────────────────────────────────────────
async function createLowStockAlert(
  product,
  variantId,
  currentStock,
  threshold
) {
  try {
    const variantName = variantId
      ? (product.variants || []).find((v) => v.id === variantId)?.name ||
        "Unknown"
      : null;

    await db.collection("lowStockAlerts").add({
      type: "LOW_STOCK_ALERT",
      productId: product.id,
      productName: product.name,
      variantId,
      variantName,
      currentStock,
      threshold,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      status: "new",
    });

    // notify admins …
    const admins = await db
      .collection("users")
      .where("roles", "array-contains", "admin")
      .get();
    const ops = [];

    admins.forEach((a) => {
      const adminId = a.id;
      const msg = variantId
        ? `${product.name} (${variantName}) low: ${currentStock} left`
        : `${product.name} low: ${currentStock} left`;

      ops.push(
        db
          .collection("notifications")
          .doc(adminId)
          .collection("userNotifications")
          .add({
            type: "LOW_STOCK_ALERT",
            title: "Low Stock Alert",
            message: msg,
            productId: product.id,
            variantId,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            read: false,
          }),
        db
          .collection("notifications")
          .doc(adminId)
          .set(
            { unreadCount: admin.firestore.FieldValue.increment(1) },
            { merge: true }
          )
      );
    });

    await Promise.all(ops);
  } catch (err) {
    console.error("createLowStockAlert error:", err);
  }
}

// ────────────────────────────────────────────────────────────────────────────────
// Helper: start an auto-reorder (writes updates to caller’s batch)
// ────────────────────────────────────────────────────────────────────────────────
async function processAutoReorder(product, variantId, batch) {
  try {
    const item = variantId
      ? (product.variants || []).find((v) => v.id === variantId)
      : product;
    if (!item) return;

    const qty = item.reorderQuantity || 50;
    const poRef = await db.collection("purchaseOrders").add({
      productId: product.id,
      productName: product.name,
      variantId,
      variantName: variantId ? item.name : null,
      quantity: qty,
      status: "pending",
      autoGenerated: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const prodRef = db.collection("products").doc(product.id);
    if (variantId) {
      const updatedVariants = (product.variants || []).map((v) =>
        v.id === variantId
          ? {
              ...v,
              reorderInProgress: true,
              lastReorderDate: admin.firestore.FieldValue.serverTimestamp(),
              lastPurchaseOrderId: poRef.id,
            }
          : v
      );
      batch.update(prodRef, { variants: updatedVariants });
    } else {
      batch.update(prodRef, {
        reorderInProgress: true,
        lastReorderDate: admin.firestore.FieldValue.serverTimestamp(),
        lastPurchaseOrderId: poRef.id,
      });
    }
  } catch (err) {
    console.error("processAutoReorder error:", err);
  }
}

// ────────────────────────────────────────────────────────────────────────────────
// 3. Firestore trigger: purchase order → update inventory on “received”
// ────────────────────────────────────────────────────────────────────────────────
exports.processPurchaseOrderUpdate = onDocumentUpdated(
  {
    document: "purchaseOrders/{poId}",
    cpu: 1,
    memory: "1GiB",
    timeoutSeconds: 60,
  },
  async (event) => {
    const before = event.data.before.data();
    const after = event.data.after.data();
    if (!before || !after) return;

    if (before.status === "received" || after.status !== "received") return;

    try {
      const prodRef = db.collection("products").doc(after.productId);
      const prodDoc = await prodRef.get();
      if (!prodDoc.exists) return;

      const product = prodDoc.data();

      if (after.variantId) {
        const updatedVariants = (product.variants || []).map((v) =>
          v.id === after.variantId
            ? {
                ...v,
                stockQuantity: (v.stockQuantity || 0) + after.quantity,
                reorderInProgress: false,
              }
            : v
        );
        await prodRef.update({ variants: updatedVariants });
      } else {
        await prodRef.update({
          stockQuantity: admin.firestore.FieldValue.increment(after.quantity),
          reorderInProgress: false,
        });
      }
    } catch (err) {
      console.error("processPurchaseOrderUpdate error:", err);
    }
  }
);

// ────────────────────────────────────────────────────────────────────────────────
// 4. Realtime trigger: product flips to in-stock → notify subscribers
// ────────────────────────────────────────────────────────────────────────────────
exports.notifyForBackInStock = onDocumentUpdated(
  {
    document: "products/{productId}",
    cpu: 1,
    memory: "1GiB",
    timeoutSeconds: 60,
  },
  async (event) => {
    const productId = event.params.productId;
    const beforeData = event.data.before.data();
    const afterData = event.data.after.data();
    if (!beforeData || !afterData) return;

    // Single-SKU product
    if (!afterData.hasVariants && !beforeData.inStock && afterData.inStock) {
      await notifySubscribers(productId, null, afterData);
      return;
    }

    // Variants: check each one
    if (afterData.hasVariants && Array.isArray(afterData.variants)) {
      const promises = [];
      afterData.variants.forEach((variant) => {
        const prev = (beforeData.variants || []).find(
          (v) => v.id === variant.id
        );
        if (variant.inStock && (!prev || !prev.inStock)) {
          promises.push(
            notifySubscribers(productId, variant.id, { ...afterData, variant })
          );
        }
      });
      await Promise.all(promises);
    }
  }
);

// ────────────────────────────────────────────────────────────────────────────────
// Helper: notify each subscriber & mark notification as sent
// ────────────────────────────────────────────────────────────────────────────────
async function notifySubscribers(productId, variantId, productData) {
  try {
    let query = db
      .collection("stockNotifications")
      .where("productId", "==", productId)
      .where("notified", "==", false);

    query = variantId
      ? query.where("variantId", "==", variantId)
      : query.where("variantId", "==", null);

    const snap = await query.get();
    if (snap.empty) return;

    const ops = [];
    snap.forEach((doc) => {
      const sn = doc.data();
      const userId = sn.userId;

      ops.push(
        db
          .collection("notifications")
          .doc(userId)
          .collection("userNotifications")
          .add({
            type: "PRODUCT_BACK_IN_STOCK",
            title: "Product Back in Stock!",
            message: `${productData.name} is now available for purchase.`,
            productId,
            variantId,
            productName: productData.name,
            productImage: productData.images?.[0] || null,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            read: false,
          }),
        db
          .collection("notifications")
          .doc(userId)
          .set(
            { unreadCount: admin.firestore.FieldValue.increment(1) },
            { merge: true }
          ),
        db.collection("stockNotifications").doc(doc.id).update({
          notified: true,
          notifiedAt: admin.firestore.FieldValue.serverTimestamp(),
        })
      );
    });

    await Promise.all(ops);
    console.log(`Notified ${snap.size} subscriber(s) for product ${productId}`);
  } catch (err) {
    console.error("notifySubscribers error:", err);
  }
}
