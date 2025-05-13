import {
  db,
  auth,
  serverTimestamp,
  increment,
  arrayUnion,
  arrayRemove,
} from "../config/firebase";
import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  getDocs,
  addDoc,
  orderBy,
  limit,
  onSnapshot,
} from "firebase/firestore";
import { sendNotification } from "./notificationService";

class WishlistService {
  constructor() {
    this.wishlistCollection = "wishlists";
    this.stockNotificationsCollection = "stockNotifications";
  }
  /**
   * Add an item to a user's wishlist
   * @param {string} userId - The user's ID
   * @param {string} productId - The product ID
   * @param {string} variantId - The product variant ID (optional)
   * @param {Object} productData - Additional product data to store
   * @returns {Promise<Object>} - Result of the operation
   */
  async addToWishlist(userId, productId, variantId = null, productData = {}) {
    try {
      // For likedProducts implementation, we ignore variantId and productData
      const userRef = doc(db, "users", userId);
      
      // Update the user document by adding the productId to the likedProducts array
      // if it doesn't already exist
      await updateDoc(userRef, {
        likedProducts: arrayUnion(productId),
        updatedAt: serverTimestamp()
      });

      return { success: true, itemId: productId };
    } catch (error) {
      console.error("Error adding item to wishlist:", error);
      return { success: false, error: error.message };
    }
  }
  /**
   * Remove an item from a user's wishlist
   * @param {string} userId - The user's ID
   * @param {string} productId - The product ID
   * @param {string} variantId - The product variant ID (optional)
   * @returns {Promise<Object>} - Result of the operation
   */
  async removeFromWishlist(userId, productId, variantId = null) {
    try {
      // For the likedProducts implementation, we ignore variantId
      const userRef = doc(db, "users", userId);
      
      // Get current likedProducts array
      const userDoc = await getDoc(userRef);
      if (!userDoc.exists()) {
        return { success: false, error: "User not found" };
      }
      
      // Update the document by removing the productId from the likedProducts array
      await updateDoc(userRef, {
        likedProducts: arrayRemove(productId),
        updatedAt: serverTimestamp()
      });

      return { success: true };
    } catch (error) {
      console.error("Error removing item from wishlist:", error);
      return { success: false, error: error.message };
    }
  }
  /**
   * Get a user's wishlist
   * @param {string} userId - The user's ID
   * @returns {Promise<Array>} - Array of wishlist items
   */
  async getWishlist(userId) {
    try {
      // First, get the user document to access likedProducts array
      const userRef = doc(db, "users", userId);
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) {
        return { success: true, items: [] };
      }

      const userData = userDoc.data();
      const likedProductIds = userData.likedProducts || [];
      
      if (likedProductIds.length === 0) {
        return { success: true, items: [] };
      }
      
      // Fetch the actual product data for each liked product ID
      const productsPromises = likedProductIds.map(async (productId) => {
        const productRef = doc(db, "products", productId);
        const productDoc = await getDoc(productRef);
        
        if (productDoc.exists()) {
          const productData = productDoc.data();
          return {
            id: productId,
            itemId: productId,
            productId,
            ...productData,
            addedAt: productData.createdAt || serverTimestamp()
          };
        }
        return null;
      });
      
      const productsResults = await Promise.all(productsPromises);
      const items = productsResults.filter(item => item !== null);

      return { success: true, items };
    } catch (error) {
      console.error("Error getting wishlist:", error);
      return { success: false, error: error.message, items: [] };
    }
  }
  /**
   * Check if a product is in the user's wishlist
   * @param {string} userId - The user's ID
   * @param {string} productId - The product ID
   * @param {string} variantId - The product variant ID (optional)
   * @returns {Promise<boolean>} - Whether the product is in the wishlist
   */
  async isInWishlist(userId, productId, variantId = null) {
    try {
      // For likedProducts implementation, we ignore variantId
      const userRef = doc(db, "users", userId);
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) {
        return false;
      }

      const userData = userDoc.data();
      const likedProducts = userData.likedProducts || [];
      
      // Check if the productId is in the likedProducts array
      return likedProducts.includes(productId);
    } catch (error) {
      console.error("Error checking if item is in wishlist:", error);
      return false;
    }
  }

  /**
   * Subscribe to back in stock notifications for a product
   * @param {string} userId - The user's ID
   * @param {string} productId - The product ID
   * @param {string} variantId - The product variant ID (optional)
   * @param {Object} productData - Additional product data to store
   * @returns {Promise<Object>} - Result of the operation
   */
  async subscribeToStockNotifications(
    userId,
    productId,
    variantId = null,
    productData = {}
  ) {
    try {
      const notificationRef = collection(db, this.stockNotificationsCollection);

      // Check if the user is already subscribed
      const q = query(
        notificationRef,
        where("userId", "==", userId),
        where("productId", "==", productId),
        variantId
          ? where("variantId", "==", variantId)
          : where("variantId", "==", null)
      );

      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        // Create new subscription
        await addDoc(notificationRef, {
          userId,
          productId,
          variantId,
          createdAt: serverTimestamp(),
          ...productData,
          notified: false,
        });
      }

      return { success: true };
    } catch (error) {
      console.error("Error subscribing to stock notifications:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Unsubscribe from back in stock notifications for a product
   * @param {string} userId - The user's ID
   * @param {string} productId - The product ID
   * @param {string} variantId - The product variant ID (optional)
   * @returns {Promise<Object>} - Result of the operation
   */
  async unsubscribeFromStockNotifications(userId, productId, variantId = null) {
    try {
      const notificationRef = collection(db, this.stockNotificationsCollection);

      const q = query(
        notificationRef,
        where("userId", "==", userId),
        where("productId", "==", productId),
        variantId
          ? where("variantId", "==", variantId)
          : where("variantId", "==", null)
      );

      const querySnapshot = await getDocs(q);

      // Delete all matching subscription documents
      const deletePromises = [];
      querySnapshot.forEach((docSnapshot) => {
        deletePromises.push(deleteDoc(docSnapshot.ref));
      });

      await Promise.all(deletePromises);

      return { success: true };
    } catch (error) {
      console.error("Error unsubscribing from stock notifications:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Check if a user is subscribed to stock notifications for a product
   * @param {string} userId - The user's ID
   * @param {string} productId - The product ID
   * @param {string} variantId - The product variant ID (optional)
   * @returns {Promise<boolean>} - Whether the user is subscribed
   */
  async isSubscribedToStockNotifications(userId, productId, variantId = null) {
    try {
      const notificationRef = collection(db, this.stockNotificationsCollection);

      const q = query(
        notificationRef,
        where("userId", "==", userId),
        where("productId", "==", productId),
        variantId
          ? where("variantId", "==", variantId)
          : where("variantId", "==", null)
      );

      const querySnapshot = await getDocs(q);

      return !querySnapshot.empty;
    } catch (error) {
      console.error("Error checking stock notification subscription:", error);
      return false;
    }
  }

  /**
   * Get all users who have subscribed to notifications for a product
   * @param {string} productId - The product ID
   * @param {string} variantId - The product variant ID (optional)
   * @returns {Promise<Array>} - Array of user IDs and their subscription data
   */
  async getStockNotificationSubscribers(productId, variantId = null) {
    try {
      const notificationRef = collection(db, this.stockNotificationsCollection);

      const q = query(
        notificationRef,
        where("productId", "==", productId),
        variantId
          ? where("variantId", "==", variantId)
          : where("variantId", "==", null),
        where("notified", "==", false)
      );

      const querySnapshot = await getDocs(q);

      const subscribers = [];
      querySnapshot.forEach((docSnapshot) => {
        subscribers.push({
          id: docSnapshot.id,
          ...docSnapshot.data(),
        });
      });

      return { success: true, subscribers };
    } catch (error) {
      console.error("Error getting stock notification subscribers:", error);
      return { success: false, error: error.message, subscribers: [] };
    }
  }

  /**
   * Mark a stock notification as sent
   * @param {string} notificationId - The notification document ID
   * @returns {Promise<Object>} - Result of the operation
   */
  async markStockNotificationAsSent(notificationId) {
    try {
      const notificationRef = doc(
        db,
        this.stockNotificationsCollection,
        notificationId
      );

      await updateDoc(notificationRef, {
        notified: true,
        notifiedAt: serverTimestamp(),
      });

      return { success: true };
    } catch (error) {
      console.error("Error marking stock notification as sent:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send notifications to all users subscribed to a product that is back in stock
   * @param {string} productId - The product ID
   * @param {string} variantId - The product variant ID (optional)
   * @param {Object} productData - Product data to include in the notification
   * @returns {Promise<Object>} - Result of the operation
   */
  async notifySubscribersOfRestockedProduct(
    productId,
    variantId = null,
    productData = {}
  ) {
    try {
      // Get all subscribers
      const { success, subscribers } =
        await this.getStockNotificationSubscribers(productId, variantId);

      if (!success || subscribers.length === 0) {
        return { success: true, notifiedCount: 0 };
      }

      // Send notifications to each subscriber
      const notificationPromises = subscribers.map(async (subscriber) => {
        // Create notification content
        const productName = productData.name || "A product you wanted";
        const notificationData = {
          type: "PRODUCT_BACK_IN_STOCK",
          title: "Product Back in Stock!",
          message: `${productName} is now back in stock and available for purchase.`,
          data: {
            productId,
            variantId,
            ...productData,
          },
        };

        // Send the notification
        await sendNotification(subscriber.userId, notificationData);

        // Mark as notified
        await this.markStockNotificationAsSent(subscriber.id);

        return subscriber.userId;
      });

      const notifiedUsers = await Promise.all(notificationPromises);

      return {
        success: true,
        notifiedCount: notifiedUsers.length,
        notifiedUsers,
      };
    } catch (error) {
      console.error("Error notifying subscribers of restocked product:", error);
      return { success: false, error: error.message, notifiedCount: 0 };
    }
  }
}

export default new WishlistService();
