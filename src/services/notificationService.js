import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  writeBatch,
  getDoc,
} from "firebase/firestore";
import { db } from "../config/firebase";

class NotificationService {
  constructor() {
    this.collection = "notifications";
  }

  /**
   * Get all notifications for a user
   * @param {string} userId - User ID
   * @returns {Promise<{success: boolean, data?: Array, error?: string}>}
   */
  async getUserNotifications(userId) {
    try {
      const notificationsRef = collection(db, this.collection);
      const q = query(notificationsRef, where("userId", "==", userId));

      const snapshot = await getDocs(q);
      const notifications = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      return { success: true, data: notifications };
    } catch (error) {
      console.error("Error getting user notifications:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Create a new notification
   * @param {Object} data - Notification data
   * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
   */
  async createNotification(data) {
    try {
      const notificationData = {
        ...data,
        read: false,
        createdAt: serverTimestamp(),
      };

      const docRef = await addDoc(
        collection(db, this.collection),
        notificationData
      );

      return {
        success: true,
        data: {
          id: docRef.id,
          ...notificationData,
        },
      };
    } catch (error) {
      console.error("Error creating notification:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Mark a notification as read
   * @param {string} notificationId - Notification ID
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async markAsRead(notificationId) {
    try {
      const notificationRef = doc(db, this.collection, notificationId);

      // Check if notification exists
      const notificationDoc = await getDoc(notificationRef);
      if (!notificationDoc.exists()) {
        return { success: false, error: "Notification not found" };
      }

      await updateDoc(notificationRef, {
        read: true,
        readAt: serverTimestamp(),
      });

      return { success: true };
    } catch (error) {
      console.error("Error marking notification as read:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Mark all notifications as read for a user
   * @param {string} userId - User ID
   * @returns {Promise<{success: boolean, count: number, error?: string}>}
   */
  async markAllAsRead(userId) {
    try {
      const notificationsRef = collection(db, this.collection);
      const q = query(
        notificationsRef,
        where("userId", "==", userId),
        where("read", "==", false)
      );

      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        return { success: true, count: 0 };
      }

      const batch = writeBatch(db);

      snapshot.docs.forEach((document) => {
        const docRef = doc(db, this.collection, document.id);
        batch.update(docRef, {
          read: true,
          readAt: serverTimestamp(),
        });
      });

      await batch.commit();

      return { success: true, count: snapshot.size };
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete a notification
   * @param {string} notificationId - Notification ID
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async deleteNotification(notificationId) {
    try {
      await deleteDoc(doc(db, this.collection, notificationId));
      return { success: true };
    } catch (error) {
      console.error("Error deleting notification:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send a role request approval notification
   * @param {string} userId - User ID receiving the notification
   * @param {string} role - Role that was approved
   * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
   */
  async sendRoleApprovalNotification(userId, role) {
    const notificationData = {
      userId,
      title: "Role Request Approved",
      message: `Your request for the ${role} role has been approved. You now have access to new features.`,
      type: "role_request_approved",
      role,
      read: false,
    };

    return await this.createNotification(notificationData);
  }

  /**
   * Send a quote request notification to manufacturers
   * @param {string} manufacturerId - Manufacturer's user ID
   * @param {string} designerName - Designer's name
   * @param {string} productName - Product name
   * @param {string} requestId - Quote request ID
   * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
   */
  async sendQuoteRequestNotification(
    manufacturerId,
    designerName,
    productName,
    requestId
  ) {
    const notificationData = {
      userId: manufacturerId,
      title: "New Quote Request",
      message: `${designerName} has requested a manufacturing quote for "${productName}".`,
      type: "quote_request",
      requestId,
      read: false,
    };

    return await this.createNotification(notificationData);
  }
}

const notificationService = new NotificationService();
export default notificationService;
