import {
  collection,
  query,
  where,
  getDocs,
  doc,
  deleteDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "../config/firebase";

class AccountDeletionService {
  /**
   * Delete all user data from Firestore collections
   * @param {string} userId - The user ID
   * @returns {Promise<{success: boolean, message?: string, error?: any}>}
   */
  async deleteUserData(userId) {
    try {
      const batch = writeBatch(db);
      let deletedDocuments = 0;

      // List of collections to check for user data
      const collectionsToClean = [
        { name: "users", field: "uid" },
        { name: "carts", field: "userId" },
        { name: "orders", field: "userId" },
        { name: "notifications", field: "userId" },
        { name: "investments", field: "userId" },
        { name: "transactions", field: "userId" },
        { name: "comments", field: "userId" },
        { name: "productViews", field: "userId" },
      ];

      // For each collection, find and queue deletion of user documents
      for (const collection of collectionsToClean) {
        const { name, field } = collection;
        const queryRef = query(
          collection(db, name),
          where(field, "==", userId)
        );

        const snapshot = await getDocs(queryRef);

        if (!snapshot.empty) {
          snapshot.forEach((document) => {
            batch.delete(document.ref);
            deletedDocuments++;
          });
        }
      }

      // Special case for products - mark as archived rather than delete
      const productsRef = query(
        collection(db, "products"),
        where("designerId", "==", userId)
      );

      const productsSnapshot = await getDocs(productsRef);
      let archivedProducts = 0;

      if (!productsSnapshot.empty) {
        productsSnapshot.forEach((productDoc) => {
          batch.update(productDoc.ref, {
            status: "archived",
            archived: true,
            archiveReason: "designer_account_deleted",
            archivedAt: new Date(),
            previousDesignerId: userId,
            designerId: null,
          });
          archivedProducts++;
        });
      }

      // Commit all the batched operations
      if (deletedDocuments > 0 || archivedProducts > 0) {
        await batch.commit();
      }

      return {
        success: true,
        message: `Successfully deleted ${deletedDocuments} documents and archived ${archivedProducts} products.`,
      };
    } catch (error) {
      console.error("Error deleting user data:", error);
      return {
        success: false,
        error: error.message || "Failed to delete user data",
      };
    }
  }
}

const accountDeletionService = new AccountDeletionService();
export default accountDeletionService;
