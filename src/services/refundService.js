import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  serverTimestamp,
  increment,
  Timestamp,
} from "firebase/firestore";
import { db } from "../config/firebase";
import walletService from "./walletService";
import notificationService from "./notificationService";

class RefundService {
  /**
   * Get order details by ID
   * @param {string} orderId - Order ID
   * @returns {Promise<Object>} Order details or error
   */
  async getOrderById(orderId) {
    try {
      const orderRef = doc(db, "orders", orderId);
      const orderDoc = await getDoc(orderRef);

      if (!orderDoc.exists()) {
        return {
          success: false,
          error: "Order not found",
        };
      }

      return {
        success: true,
        data: {
          id: orderDoc.id,
          ...orderDoc.data(),
        },
      };
    } catch (error) {
      console.error("Error fetching order:", error);
      return {
        success: false,
        error: error.message || "Failed to fetch order",
      };
    }
  }

  /**
   * Get refundable orders with pagination
   * @param {number} limitCount - Number of orders to fetch
   * @param {Object} lastDoc - Last document for pagination
   * @returns {Promise<Object>} List of refundable orders or error
   */
  async getRefundableOrders(limitCount = 10, lastDoc = null) {
    try {
      const ordersRef = collection(db, "orders");
      let q;

      // Only completed orders with payment status "paid" are refundable
      if (lastDoc) {
        q = query(
          ordersRef,
          where("paymentStatus", "==", "paid"),
          where("refundStatus", "!=", "refunded"),
          orderBy("refundStatus"),
          orderBy("createdAt", "desc"),
          startAfter(lastDoc),
          limit(limitCount)
        );
      } else {
        q = query(
          ordersRef,
          where("paymentStatus", "==", "paid"),
          where("refundStatus", "!=", "refunded"),
          orderBy("refundStatus"),
          orderBy("createdAt", "desc"),
          limit(limitCount)
        );
      }

      const snapshot = await getDocs(q);
      const orders = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
      }));

      const lastVisible =
        snapshot.docs.length > 0
          ? snapshot.docs[snapshot.docs.length - 1]
          : null;

      return {
        success: true,
        data: orders,
        lastVisible,
        hasMore: snapshot.docs.length === limitCount,
      };
    } catch (error) {
      console.error("Error getting refundable orders:", error);
      return {
        success: false,
        error: error.message || "Failed to fetch refundable orders",
      };
    }
  }

  /**
   * Get refunded orders with pagination
   * @param {number} limitCount - Number of orders to fetch
   * @param {Object} lastDoc - Last document for pagination
   * @returns {Promise<Object>} List of refunded orders or error
   */
  async getRefundedOrders(limitCount = 10, lastDoc = null) {
    try {
      const ordersRef = collection(db, "orders");
      let q;

      if (lastDoc) {
        q = query(
          ordersRef,
          where("refundStatus", "==", "refunded"),
          orderBy("refundDate", "desc"),
          startAfter(lastDoc),
          limit(limitCount)
        );
      } else {
        q = query(
          ordersRef,
          where("refundStatus", "==", "refunded"),
          orderBy("refundDate", "desc"),
          limit(limitCount)
        );
      }

      const snapshot = await getDocs(q);
      const orders = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        refundDate: doc.data().refundDate?.toDate() || new Date(),
      }));

      const lastVisible =
        snapshot.docs.length > 0
          ? snapshot.docs[snapshot.docs.length - 1]
          : null;

      return {
        success: true,
        data: orders,
        lastVisible,
        hasMore: snapshot.docs.length === limitCount,
      };
    } catch (error) {
      console.error("Error getting refunded orders:", error);
      return {
        success: false,
        error: error.message || "Failed to fetch refunded orders",
      };
    }
  }

  /**
   * Process a refund for an order
   * @param {string} orderId - Order ID to refund
   * @param {string} adminId - Admin user ID processing the refund
   * @param {string} reason - Reason for refund
   * @param {boolean} refundAll - Whether to refund entire order or selected items
   * @param {Array} refundItems - Array of item IDs to refund if not refunding all
   * @returns {Promise<Object>} Result of refund operation
   */
  async processRefund(
    orderId,
    adminId,
    reason,
    refundAll = true,
    refundItems = []
  ) {
    try {
      // 1. Get the order
      const orderRef = doc(db, "orders", orderId);
      const orderDoc = await getDoc(orderRef);

      if (!orderDoc.exists()) {
        return {
          success: false,
          error: "Order not found",
        };
      }

      const orderData = orderDoc.data();
      const userId = orderData.userId;

      // Make sure order has not already been refunded
      if (orderData.refundStatus === "refunded") {
        return {
          success: false,
          error: "This order has already been refunded",
        };
      }

      // Calculate refund amount
      let refundAmount = 0;
      let itemsToRefund = [];

      if (refundAll) {
        refundAmount = orderData.total;
        itemsToRefund = orderData.items;
      } else {
        // Find specific items to refund
        itemsToRefund = orderData.items.filter((item) =>
          refundItems.includes(item.id)
        );

        // Calculate total for selected items
        refundAmount = itemsToRefund.reduce((sum, item) => {
          return sum + item.price * item.quantity;
        }, 0);

        // Add proportional shipping if applicable
        if (orderData.shipping && itemsToRefund.length > 0) {
          const proportionToRefund =
            itemsToRefund.length / orderData.items.length;
          refundAmount += orderData.shipping * proportionToRefund;
        }
      }

      // Ensure refund amount is valid
      if (refundAmount <= 0) {
        return {
          success: false,
          error: "Invalid refund amount",
        };
      }

      // Begin processing refund
      // 1. Return money to customer's wallet
      const walletResult = await walletService.addToWallet(
        userId,
        refundAmount,
        `Refund for order #${orderId.slice(-6)}`
      );

      if (!walletResult.success) {
        return {
          success: false,
          error: walletResult.error || "Failed to process customer refund",
        };
      }

      // 2. Record the refund transaction
      await addDoc(collection(db, "transactions"), {
        userId,
        type: "refund",
        amount: refundAmount,
        description: `Refund for order #${orderId.slice(-6)}${
          reason ? ": " + reason : ""
        }`,
        orderId,
        status: "completed",
        createdAt: serverTimestamp(),
        processedBy: adminId,
      });

      // 3. For each product in the refunded items, process investor revenue reversal
      for (const item of itemsToRefund) {
        await this.reverseInvestorRevenue(
          item.id,
          item.price * item.quantity,
          orderId
        );

        // If the product has a designer, retrieve business commission from the designer
        await this.reverseDesignerRevenue(
          item.id,
          item.price * item.quantity,
          orderId
        );
      }

      // 4. Update the order status
      const updateData = {
        refundStatus: "refunded",
        refundDate: serverTimestamp(),
        refundReason: reason,
        refundedBy: adminId,
        refundedItems: refundAll ? "all" : refundItems,
        refundAmount,
      };

      // If all items were refunded, update the order status too
      if (refundAll) {
        updateData.status = "refunded";
      }

      await updateDoc(orderRef, updateData);

      // 5. Send notification to customer
      await notificationService.createNotification(
        userId,
        "order_refunded",
        "Order Refunded",
        `Your order #${orderId.slice(-6)} has been refunded${
          reason ? ": " + reason : ""
        }. The amount of ${refundAmount.toFixed(
          2
        )} has been added to your wallet.`,
        `/wallet`
      );

      return {
        success: true,
        message: `Successfully refunded ${refundAmount.toFixed(
          2
        )} to customer's wallet`,
        refundAmount,
      };
    } catch (error) {
      console.error("Error processing refund:", error);
      return {
        success: false,
        error: error.message || "Failed to process refund",
      };
    }
  }

  /**
   * Reverse investor revenue for a refunded product
   * @param {string} productId - Product ID
   * @param {number} saleAmount - Sale amount to reverse
   * @param {string} orderId - Order ID for reference
   * @returns {Promise<Object>} Result of revenue reversal
   */
  async reverseInvestorRevenue(productId, saleAmount, orderId) {
    try {
      // 1. Check if the product had investor revenue distributed for this order
      const transactionsRef = collection(db, "transactions");
      const q = query(
        transactionsRef,
        where("type", "==", "revenue_share"),
        where("productId", "==", productId),
        where("orderId", "==", orderId)
      );

      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        // No investor revenue to reverse
        return { success: true, message: "No investor revenue to reverse" };
      }

      // For each investor transaction, create a reversal
      for (const doc of snapshot.docs) {
        const transaction = doc.data();
        const investorId = transaction.userId;
        const amount = transaction.amount;

        // 1. Deduct from investor's wallet
        await walletService.deductFunds(
          investorId,
          amount,
          `Reversal of revenue share for refunded order #${orderId.slice(-6)}`
        );

        // 2. Record the reversal transaction
        await addDoc(collection(db, "transactions"), {
          userId: investorId,
          type: "revenue_reversal",
          amount: -amount,
          description: `Reversal of revenue share for refunded product (Order #${orderId.slice(
            -6
          )})`,
          productId,
          orderId,
          referencedTransactionId: doc.id,
          createdAt: serverTimestamp(),
          status: "completed",
        });

        // 3. Notify the investor
        await notificationService.createNotification(
          investorId,
          "revenue_reversal",
          "Revenue Share Reversed",
          `Due to a refund, ${amount.toFixed(
            2
          )} credits of revenue share from order #${orderId.slice(
            -6
          )} has been reversed.`,
          `/portfolio`
        );
      }

      return { success: true };
    } catch (error) {
      console.error("Error reversing investor revenue:", error);
      return {
        success: false,
        error: error.message || "Failed to reverse investor revenue",
      };
    }
  }

  /**
   * Reverse designer revenue for a refunded product
   * @param {string} productId - Product ID
   * @param {number} saleAmount - Sale amount to reverse
   * @param {string} orderId - Order ID for reference
   * @returns {Promise<Object>} Result of revenue reversal
   */
  async reverseDesignerRevenue(productId, saleAmount, orderId) {
    try {
      // 1. Get the product to find the designer
      const productRef = doc(db, "products", productId);
      const productDoc = await getDoc(productRef);

      if (!productDoc.exists()) {
        return {
          success: false,
          error: "Product not found",
        };
      }

      const productData = productDoc.data();
      const designerId = productData.designerId;

      if (!designerId) {
        return { success: true, message: "No designer found for this product" };
      }

      // 2. Check if there was a designer commission transaction for this order
      const transactionsRef = collection(db, "transactions");
      const q = query(
        transactionsRef,
        where("type", "==", "designer_commission"),
        where("productId", "==", productId),
        where("orderId", "==", orderId)
      );

      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        // No designer commission to reverse
        return { success: true, message: "No designer commission to reverse" };
      }

      // For each designer transaction, create a reversal
      for (const doc of snapshot.docs) {
        const transaction = doc.data();
        const amount = transaction.amount;

        // 1. Deduct from designer's wallet
        await walletService.deductFunds(
          designerId,
          amount,
          `Reversal of commission for refunded order #${orderId.slice(-6)}`
        );

        // 2. Record the reversal transaction
        await addDoc(collection(db, "transactions"), {
          userId: designerId,
          type: "commission_reversal",
          amount: -amount,
          description: `Reversal of commission for refunded product (Order #${orderId.slice(
            -6
          )})`,
          productId,
          orderId,
          referencedTransactionId: doc.id,
          createdAt: serverTimestamp(),
          status: "completed",
        });

        // 3. Notify the designer
        await notificationService.createNotification(
          designerId,
          "commission_reversal",
          "Commission Reversed",
          `Due to a refund, ${amount.toFixed(
            2
          )} credits of commission from order #${orderId.slice(
            -6
          )} has been reversed.`,
          `/dashboard`
        );
      }

      return { success: true };
    } catch (error) {
      console.error("Error reversing designer revenue:", error);
      return {
        success: false,
        error: error.message || "Failed to reverse designer revenue",
      };
    }
  }

  /**
   * Get refund history for a customer
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Refund history or error
   */
  async getCustomerRefundHistory(userId) {
    try {
      const transactionsRef = collection(db, "transactions");
      const q = query(
        transactionsRef,
        where("userId", "==", userId),
        where("type", "==", "refund"),
        orderBy("createdAt", "desc")
      );

      const snapshot = await getDocs(q);
      const refunds = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
      }));

      return {
        success: true,
        data: refunds,
      };
    } catch (error) {
      console.error("Error getting customer refund history:", error);
      return {
        success: false,
        error: error.message || "Failed to fetch refund history",
      };
    }
  }

  /**
   * Get refund requests for a designer's products
   * @param {string} designerId - Designer's user ID
   * @returns {Promise<Object>} List of refund requests or error
   */
  async getRefundRequestsForDesigner(designerId) {
    try {
      // First, get the designer's products
      const productsRef = collection(db, "products");
      const productsQuery = query(
        productsRef,
        where("designerId", "==", designerId),
        where("status", "==", "approved")
      );

      const productsSnapshot = await getDocs(productsQuery);

      if (productsSnapshot.empty) {
        return {
          success: true,
          data: [],
          message: "No products found for this designer",
        };
      }

      // Get product IDs
      const productIds = productsSnapshot.docs.map((doc) => doc.id);

      // Get orders with refund requests containing these products
      const ordersRef = collection(db, "orders");
      const ordersQuery = query(
        ordersRef,
        where("refundStatus", "==", "requested"),
        orderBy("refundRequestDate", "desc")
      );

      const ordersSnapshot = await getDocs(ordersQuery);

      if (ordersSnapshot.empty) {
        return {
          success: true,
          data: [],
          message: "No refund requests found",
        };
      }

      // Filter orders that contain the designer's products
      const refundRequests = [];

      ordersSnapshot.docs.forEach((doc) => {
        const orderData = doc.data();
        const items = orderData.items || [];

        // Check if any item in the order is from this designer
        const hasDesignerProduct = items.some((item) =>
          productIds.includes(item.id)
        );

        if (hasDesignerProduct) {
          refundRequests.push({
            id: doc.id,
            ...orderData,
            refundRequestDate:
              orderData.refundRequestDate?.toDate() || new Date(),
            createdAt: orderData.createdAt?.toDate() || new Date(),
          });
        }
      });

      return {
        success: true,
        data: refundRequests,
      };
    } catch (error) {
      console.error("Error getting refund requests for designer:", error);
      return {
        success: false,
        error: error.message || "Failed to fetch refund requests",
      };
    }
  }

  /**
   * Deny a refund request
   * @param {string} orderId - Order ID
   * @param {string} designerId - Designer's user ID
   * @param {string} reason - Reason for denying the refund
   * @returns {Promise<Object>} Result of operation
   */
  async denyRefundRequest(orderId, designerId, reason) {
    try {
      const orderRef = doc(db, "orders", orderId);
      const orderDoc = await getDoc(orderRef);

      if (!orderDoc.exists()) {
        return {
          success: false,
          error: "Order not found",
        };
      }

      const orderData = orderDoc.data();

      // Make sure order has a refund request
      if (orderData.refundStatus !== "requested") {
        return {
          success: false,
          error: "This order does not have a pending refund request",
        };
      }

      // Update the order status
      await updateDoc(orderRef, {
        refundStatus: "denied",
        refundDeniedDate: serverTimestamp(),
        refundDeniedReason: reason,
        refundDeniedBy: designerId,
      });

      // Send notification to customer
      await notificationService.createNotification(
        orderData.userId,
        "refund_denied",
        "Refund Request Denied",
        `Your refund request for order #${orderId.slice(-6)} has been denied${
          reason ? ": " + reason : ""
        }. Please contact customer support if you have any questions.`,
        `/orders`
      );

      return {
        success: true,
        message: "Refund request denied successfully",
      };
    } catch (error) {
      console.error("Error denying refund request:", error);
      return {
        success: false,
        error: error.message || "Failed to deny refund request",
      };
    }
  }
}

export default new RefundService();
