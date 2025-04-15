import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../config/firebase";
import notificationService from "./notificationService";

class ProductArchiveService {
  /**
   * Get all archived products
   * @param {Object} options - Query options
   * @param {number} [options.limit=20] - Maximum number of products to fetch
   * @returns {Promise<Object>} - The archived products or error
   */
  async getArchivedProducts(options = {}) {
    try {
      const { limit = 20 } = options;

      const productsRef = collection(db, "products");
      const q = query(
        productsRef,
        where("status", "==", "archived"),
        where("archived", "==", true),
        limit(limit)
      );

      const snapshot = await getDocs(q);
      const products = [];

      snapshot.forEach((doc) => {
        products.push({
          id: doc.id,
          ...doc.data(),
        });
      });

      return {
        success: true,
        data: products,
      };
    } catch (error) {
      console.error("Error getting archived products:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Archive a product
   * @param {string} productId - Product ID to archive
   * @param {string} reason - Reason for archiving
   * @param {boolean} notifyDesigner - Whether to notify the designer
   * @returns {Promise<Object>} - Result of the archiving operation
   */
  async archiveProduct(
    productId,
    reason = "manual_archive",
    notifyDesigner = true
  ) {
    try {
      // Get product data first
      const productRef = doc(db, "products", productId);
      const productDoc = await getDoc(productRef);

      if (!productDoc.exists()) {
        return {
          success: false,
          error: "Product not found",
        };
      }

      const productData = productDoc.data();

      // Update product status
      await updateDoc(productRef, {
        status: "archived",
        archived: true,
        archivedAt: serverTimestamp(),
        archiveReason: reason,
      });

      // Notify designer if requested
      if (notifyDesigner && productData.designerId) {
        await notificationService.createNotification({
          userId: productData.designerId,
          title: "Product Archived",
          message: `Your product "${
            productData.name
          }" has been archived. Reason: ${this.formatReason(reason)}`,
          type: "product_archived",
          productId,
          productName: productData.name,
        });
      }

      return {
        success: true,
        data: {
          productId,
          status: "archived",
        },
      };
    } catch (error) {
      console.error("Error archiving product:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Restore an archived product
   * @param {string} productId - Product ID to restore
   * @returns {Promise<Object>} - Result of the restore operation
   */
  async restoreProduct(productId) {
    try {
      // Get product data first
      const productRef = doc(db, "products", productId);
      const productDoc = await getDoc(productRef);

      if (!productDoc.exists()) {
        return {
          success: false,
          error: "Product not found",
        };
      }

      const productData = productDoc.data();

      // Check if product is archived
      if (productData.status !== "archived") {
        return {
          success: false,
          error: "Product is not archived",
        };
      }

      // Update product status
      await updateDoc(productRef, {
        status: "active",
        archived: false,
        restoredAt: serverTimestamp(),
      });

      // Notify designer about restoration
      if (productData.designerId) {
        await notificationService.createNotification({
          userId: productData.designerId,
          title: "Product Restored",
          message: `Your product "${productData.name}" has been restored and is now active again.`,
          type: "product_restored",
          productId,
          productName: productData.name,
        });
      }

      return {
        success: true,
        data: {
          productId,
          status: "active",
        },
      };
    } catch (error) {
      console.error("Error restoring product:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Manually trigger the product deadline check function
   * @param {string} [overrideDate] - Optional date string to override the current date
   * @returns {Promise<Object>} - Result of the check operation
   */
  async manuallyCheckDeadlines(overrideDate = null) {
    try {
      const checkFunction = httpsCallable(
        functions,
        "manuallyCheckProductDeadlines"
      );

      const result = await checkFunction({
        overrideDate,
      });

      return {
        success: true,
        data: result.data,
      };
    } catch (error) {
      console.error("Error triggering deadline check:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Format archive reason to be human-readable
   * @param {string} reason - The archive reason code
   * @returns {string} - Human-readable reason
   */
  formatReason(reason) {
    const reasons = {
      funding_goal_not_met: "Funding goal not met by deadline",
      manual_archive: "Manually archived by administrator",
      designer_request: "Archived at designer's request",
      policy_violation: "Policy violation",
      no_longer_available: "Product is no longer available",
    };

    return reasons[reason] || reason;
  }
}

const productArchiveService = new ProductArchiveService();
export default productArchiveService;
