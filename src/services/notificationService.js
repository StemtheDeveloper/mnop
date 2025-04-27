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
   * Delete all notifications for a user
   * @param {string} userId - User ID
   * @returns {Promise<{success: boolean, count: number, error?: string}>}
   */
  async deleteAllNotifications(userId) {
    try {
      const notificationsRef = collection(db, this.collection);
      const q = query(notificationsRef, where("userId", "==", userId));

      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        return { success: true, count: 0 };
      }

      const batch = writeBatch(db);

      snapshot.docs.forEach((document) => {
        const docRef = doc(db, this.collection, document.id);
        batch.delete(docRef);
      });

      await batch.commit();

      return { success: true, count: snapshot.size };
    } catch (error) {
      console.error("Error deleting all notifications:", error);
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

  /**
   * Send product approved notification
   */
  async sendProductApprovalNotification(userId, productId, productName) {
    const notificationData = {
      userId,
      type: "product_approved",
      title: "Product Approved",
      message: `Your product "${productName}" has been approved and is now live!`,
      link: `/product/${productId}`,
      read: false,
      createdAt: serverTimestamp(),
    };

    return await this.createNotification(notificationData);
  }

  /**
   * Send product rejected notification
   * @param {string} userId - Designer's user ID
   * @param {string} productId - Product ID
   * @param {string} productName - Product name
   * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
   */
  async sendProductRejectionNotification(userId, productId, productName) {
    const notificationData = {
      userId,
      type: "product_rejected",
      title: "Product Rejected",
      message: `Your product "${productName}" has been rejected. Please check the details and consider making improvements.`,
      link: `/product/${productId}`,
      read: false,
      createdAt: serverTimestamp(),
    };

    return await this.createNotification(notificationData);
  }

  /**
   * Send investment notification
   */
  async sendInvestmentNotification(
    designerId,
    investorName,
    amount,
    productId,
    productName
  ) {
    const notificationData = {
      userId: designerId,
      type: "investment",
      title: "New Investment",
      message: `${investorName} has invested $${amount} in your product "${productName}"`,
      link: `/product/${productId}`,
      read: false,
      createdAt: serverTimestamp(),
    };

    return await this.createNotification(notificationData);
  }

  /**
   * Send investment confirmation notification to investor
   * @param {string} investorId - Investor's user ID
   * @param {number} amount - Investment amount
   * @param {string} productId - Product ID
   * @param {string} productName - Product name
   * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
   */
  async sendInvestmentConfirmationNotification(
    investorId,
    amount,
    productId,
    productName
  ) {
    const notificationData = {
      userId: investorId,
      type: "investment_confirmation",
      title: "Investment Successful",
      message: `You have successfully invested $${amount} in "${productName}"`,
      link: `/product/${productId}`,
      read: false,
      createdAt: serverTimestamp(),
    };

    return await this.createNotification(notificationData);
  }

  /**
   * Send message notification
   */
  async sendMessageNotification(
    recipientId,
    senderName,
    messagePreview,
    conversationId
  ) {
    const notificationData = {
      userId: recipientId,
      type: "message",
      title: "New Message",
      message: `${senderName}: ${messagePreview.substring(0, 100)}${
        messagePreview.length > 100 ? "..." : ""
      }`,
      link: `/messages/${conversationId}`,
      read: false,
      createdAt: serverTimestamp(),
    };

    return await this.createNotification(notificationData);
  }

  /**
   * Send trending product notification
   */
  async sendTrendingNotification(designerId, productId, productName) {
    const notificationData = {
      userId: designerId,
      type: "trending",
      title: "Trending Product",
      message: `Your product "${productName}" is trending! It's receiving a lot of attention.`,
      link: `/product/${productId}`,
      read: false,
      createdAt: serverTimestamp(),
    };

    return await this.createNotification(notificationData);
  }

  /**
   * Send expiring product notification
   */
  async sendExpiringNotification(designerId, productId, productName, daysLeft) {
    const notificationData = {
      userId: designerId,
      type: "expiring",
      title: "Product Expiring Soon",
      message: `Your product "${productName}" will expire in ${daysLeft} days. Consider extending it if it's trending.`,
      link: `/product/${productId}`,
      read: false,
      createdAt: serverTimestamp(),
    };

    return await this.createNotification(notificationData);
  }

  /**
   * Send role change notification
   */
  async sendRoleChangeNotification(userId, role) {
    const notificationData = {
      userId: userId,
      type: "role_change",
      title: "Role Updated",
      message: `Your account now has the ${role} role.`,
      link: `/profile`,
      read: false,
      createdAt: serverTimestamp(),
    };

    return await this.createNotification(notificationData);
  }

  /**
   * Send currency transfer notification
   */
  async sendTransferNotification(userId, amount, isDeposit) {
    const notificationData = {
      userId: userId,
      type: "transfer",
      title: isDeposit ? "Deposit Successful" : "Withdrawal Successful",
      message: isDeposit
        ? `$${amount} has been added to your wallet.`
        : `$${amount} has been withdrawn from your wallet.`,
      link: `/wallet`,
      read: false,
      createdAt: serverTimestamp(),
    };

    return await this.createNotification(notificationData);
  }

  /**
   * Send interest payment notification
   * @param {string} userId - User ID receiving the notification
   * @param {number} amount - Interest amount
   * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
   */
  async sendInterestNotification(userId, amount) {
    const notificationData = {
      userId,
      type: "interest",
      title: "Interest Payment",
      message: `You've earned ${new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }).format(amount)} in interest on your wallet balance.`,
      link: "/wallet?tab=interest",
      read: false,
      createdAt: serverTimestamp(),
    };

    return await this.createNotification(notificationData);
  }

  /**
   * Send notification to admins about pending products
   * @param {string} adminId - Admin user ID
   * @param {number} pendingCount - Number of pending products
   * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
   */
  async sendPendingProductsNotification(adminId, pendingCount) {
    const notificationData = {
      userId: adminId,
      type: "pending_review",
      title: "Products Awaiting Review",
      message: `There ${
        pendingCount === 1 ? "is" : "are"
      } ${pendingCount} product${
        pendingCount === 1 ? "" : "s"
      } waiting for your review.`,
      link: "/admin?tab=product-approval",
      read: false,
      createdAt: serverTimestamp(),
    };

    return await this.createNotification(notificationData);
  }

  /**
   * Send order notification to a designer when their product is ordered
   * @param {string} designerId - Designer's user ID
   * @param {string} productId - Product ID
   * @param {string} productName - Product name
   * @param {string} orderId - Order ID
   * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
   */
  async sendOrderNotification(designerId, productId, productName, orderId) {
    const notificationData = {
      userId: designerId,
      type: "order_received",
      title: "New Order Received",
      message: `Your product "${productName}" has been ordered and is awaiting delivery.`,
      link: `/orders/designer/${orderId}`,
      productId,
      orderId,
      read: false,
      createdAt: serverTimestamp(),
    };

    return await this.createNotification(notificationData);
  }

  /**
   * Send revenue share notification
   * @param {string} investorId - Investor's user ID
   * @param {number} amount - Revenue share amount
   * @param {string} productId - Product ID
   * @param {string} productName - Product name
   * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
   */
  async sendRevenueShareNotification(
    investorId,
    amount,
    productId,
    productName
  ) {
    const notificationData = {
      userId: investorId,
      type: "revenue_share",
      title: "Investment Revenue",
      message: `You've earned $${amount.toFixed(2)} in revenue from sales of "${productName}" that you invested in!`,
      link: `/portfolio`,
      read: false,
      createdAt: serverTimestamp(),
    };

    return await this.createNotification(notificationData);
  }
}

const notificationService = new NotificationService();
export default notificationService;
