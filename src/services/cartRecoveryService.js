import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  setDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  Timestamp,
  writeBatch,
  onSnapshot,
  deleteDoc,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { getFunctions, httpsCallable } from "firebase/functions";
import notificationService from "./notificationService";

/**
 * Service for managing abandoned carts and sending recovery emails
 */
class CartRecoveryService {
  /**
   * Track a cart as potentially abandoned
   * @param {string} userId - User ID
   * @param {string} cartId - Cart ID
   * @param {Array} items - Cart items
   * @returns {Promise<Object>} Result with success status
   */
  async trackCart(userId, cartId, items) {
    try {
      // Only track carts with items
      if (!items || items.length === 0) {
        return { success: false, message: "Cart is empty" };
      }

      // Check if this cart is already being tracked
      const abandonedCartsRef = collection(db, "abandonedCarts");
      const q = query(abandonedCartsRef, where("cartId", "==", cartId));
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        // Update existing record
        const docId = snapshot.docs[0].id;
        await updateDoc(doc(db, "abandonedCarts", docId), {
          items,
          updatedAt: serverTimestamp(),
          emailsSent: snapshot.docs[0].data().emailsSent || 0,
          recovered: false,
        });
      } else {
        // Create new abandoned cart record
        await addDoc(abandonedCartsRef, {
          userId,
          cartId,
          items,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          emailsSent: 0,
          recovered: false,
          lastEmailSent: null,
        });
      }

      return { success: true };
    } catch (error) {
      console.error("Error tracking abandoned cart:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Mark a cart as recovered when a purchase is completed
   * @param {string} cartId - Cart ID
   * @returns {Promise<Object>} Result with success status
   */
  async markCartAsRecovered(cartId) {
    try {
      const abandonedCartsRef = collection(db, "abandonedCarts");
      const q = query(abandonedCartsRef, where("cartId", "==", cartId));
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        const docId = snapshot.docs[0].id;
        await updateDoc(doc(db, "abandonedCarts", docId), {
          recovered: true,
          recoveredAt: serverTimestamp(),
        });

        // Record analytics for recovery
        await this.recordRecoveryAnalytics(snapshot.docs[0].data());

        return { success: true };
      }

      return { success: false, message: "Cart not found" };
    } catch (error) {
      console.error("Error marking cart as recovered:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Record analytics for cart recovery
   * @param {Object} cartData - Abandoned cart data
   * @returns {Promise<void>}
   */
  async recordRecoveryAnalytics(cartData) {
    try {
      // Calculate cart value
      const cartValue = cartData.items.reduce(
        (total, item) => total + item.price * item.quantity,
        0
      );

      // Record recovery metrics
      await addDoc(collection(db, "cartRecoveryAnalytics"), {
        cartId: cartData.cartId,
        userId: cartData.userId,
        emailsSent: cartData.emailsSent,
        daysToRecover: this.calculateDaysToRecover(
          cartData.createdAt,
          serverTimestamp()
        ),
        cartValue,
        recoveredAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Error recording recovery analytics:", error);
    }
  }

  /**
   * Calculate days between cart abandonment and recovery
   * @param {Timestamp} created - Creation timestamp
   * @param {Timestamp} recovered - Recovery timestamp
   * @returns {number} Number of days
   */
  calculateDaysToRecover(created, recovered) {
    if (!created || !recovered) return 0;

    const createdDate = created.toDate ? created.toDate() : new Date(created);
    const recoveredDate = recovered.toDate
      ? recovered.toDate()
      : new Date(recovered);

    const diffTime = Math.abs(recoveredDate - createdDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return diffDays;
  }

  /**
   * Find and process abandoned carts for email reminders
   * @returns {Promise<Object>} Result with number of emails sent
   */
  async processAbandonedCarts() {
    try {
      const abandonedCartsRef = collection(db, "abandonedCarts");
      // Get carts that:
      // 1. Have not been recovered
      // 2. Are at least 1 hour old (to give customers time to complete purchase)
      // 3. Have not received too many emails

      const oneHourAgo = new Date();
      oneHourAgo.setHours(oneHourAgo.getHours() - 1);

      const q = query(
        abandonedCartsRef,
        where("recovered", "==", false),
        where("updatedAt", "<=", oneHourAgo),
        where("emailsSent", "<", 3) // Maximum 3 reminder emails
      );

      const snapshot = await getDocs(q);
      let emailsSent = 0;

      const batch = writeBatch(db);

      for (const cartDoc of snapshot.docs) {
        const cart = cartDoc.data();

        // Check when the last email was sent (if any)
        if (cart.lastEmailSent) {
          const lastEmailDate = cart.lastEmailSent.toDate();
          const currentDate = new Date();
          const hoursSinceLastEmail =
            (currentDate - lastEmailDate) / (1000 * 60 * 60);

          // For first reminder: 1 hour after abandonment
          // For second reminder: 24 hours after first reminder
          // For third reminder: 72 hours after second reminder
          const hoursToWait =
            cart.emailsSent === 1 ? 24 : cart.emailsSent === 2 ? 72 : 0;

          if (hoursSinceLastEmail < hoursToWait) {
            continue; // Skip this cart, not time for next email yet
          }
        }

        // Get user info for personalized email
        let userEmail, userName;
        try {
          const userDoc = await getDoc(doc(db, "users", cart.userId));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            userEmail = userData.email;
            userName =
              userData.displayName || userData.firstName || "Valued Customer";
          } else {
            console.log(
              `User ${cart.userId} not found for abandoned cart ${cart.cartId}`
            );
            continue; // Skip this cart, can't send email without user
          }
        } catch (error) {
          console.error(`Error fetching user data for ${cart.userId}:`, error);
          continue;
        }

        // Send the reminder email
        const emailSent = await this.sendCartReminderEmail(
          userEmail,
          userName,
          cart.cartId,
          cart.items,
          cart.emailsSent + 1
        );

        if (emailSent) {
          // Update the cart record
          batch.update(doc(db, "abandonedCarts", cartDoc.id), {
            emailsSent: cart.emailsSent + 1,
            lastEmailSent: serverTimestamp(),
          });

          emailsSent++;

          // Also send in-app notification
          await this.sendCartReminderNotification(
            cart.userId,
            cart.items.length,
            cart.cartId
          );
        }
      }

      // Commit all updates
      if (emailsSent > 0) {
        await batch.commit();
      }

      return { success: true, emailsSent };
    } catch (error) {
      console.error("Error processing abandoned carts:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send an email reminder for an abandoned cart
   * @param {string} email - User's email
   * @param {string} name - User's name
   * @param {string} cartId - Cart ID
   * @param {Array} items - Cart items
   * @param {number} reminderNumber - Which reminder this is (1, 2, or 3)
   * @returns {Promise<boolean>} True if email was sent successfully
   */
  async sendCartReminderEmail(email, name, cartId, items, reminderNumber) {
    try {
      if (!email) return false;

      // Calculate cart total
      const cartTotal = items.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
      );

      // Prepare discount code for the final reminder
      let discountCode = null;
      if (reminderNumber === 3) {
        // Generate a unique discount code for the final reminder
        discountCode = `COMEBACK-${Math.random()
          .toString(36)
          .substring(2, 10)
          .toUpperCase()}`;

        // Save the discount code in Firestore
        await addDoc(collection(db, "discountCodes"), {
          code: discountCode,
          userId: items[0]?.userId,
          cartId,
          discount: 10, // 10% discount
          type: "percentage",
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days expiry
          used: false,
          createdAt: serverTimestamp(),
        });
      }

      // Get the subject and message based on reminder number
      const { subject, message } = this.getReminderEmailContent(
        name,
        items,
        cartTotal,
        reminderNumber,
        discountCode
      );

      // Send the email using Firebase Cloud Function
      const functions = getFunctions();
      const sendEmail = httpsCallable(functions, "sendEmail");

      await sendEmail({
        to: email,
        subject,
        html: message,
        cartId,
        items,
        reminderNumber,
      });

      // Log the email sending
      await addDoc(collection(db, "emailLogs"), {
        userId: items[0]?.userId,
        type: "cart_recovery",
        reminderNumber,
        cartId,
        sentAt: serverTimestamp(),
        discountCode,
      });

      return true;
    } catch (error) {
      console.error("Error sending cart reminder email:", error);
      return false;
    }
  }

  /**
   * Get email content for abandoned cart reminder
   * @param {string} name - User's name
   * @param {Array} items - Cart items
   * @param {number} cartTotal - Total cart value
   * @param {number} reminderNumber - Which reminder (1, 2, or 3)
   * @param {string} discountCode - Discount code (for reminder 3)
   * @returns {Object} Subject and message
   */
  getReminderEmailContent(
    name,
    items,
    cartTotal,
    reminderNumber,
    discountCode
  ) {
    // Format cart total as currency
    const formattedTotal = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(cartTotal);

    // Generate item list HTML
    const itemsHTML = items
      .map(
        (item) =>
          `<div style="display: flex; margin-bottom: 10px; padding: 10px; background-color: #f8f8f8; border-radius: 5px;">
        <img src="${
          item.imageUrl || "https://via.placeholder.com/60?text=Product"
        }" alt="${
            item.name
          }" style="width: 60px; height: 60px; margin-right: 15px; object-fit: cover;">
        <div>
          <h3 style="margin: 0 0 5px 0; font-size: 16px;">${item.name}</h3>
          <p style="margin: 0; color: #666;">Quantity: ${item.quantity}</p>
          <p style="margin: 5px 0 0 0; font-weight: bold;">$${(
            item.price * item.quantity
          ).toFixed(2)}</p>
        </div>
      </div>`
      )
      .join("");

    let subject, message;

    switch (reminderNumber) {
      case 1:
        subject = `${name}, you left items in your cart!`;
        message = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Hello ${name},</h2>
            <p>We noticed you still have items in your shopping cart. Did you want to complete your purchase?</p>
            
            <h3>Your cart: ${items.length} ${
          items.length === 1 ? "item" : "items"
        } - ${formattedTotal}</h3>
            
            <div style="margin: 20px 0;">
              ${itemsHTML}
            </div>
            
            <a href="https://your-website.com/cart" style="display: inline-block; background-color: #ef3c23; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">Return to Cart</a>
            
            <p style="margin-top: 30px; color: #666; font-size: 14px;">If you have any questions, please contact our customer support.</p>
          </div>
        `;
        break;

      case 2:
        subject = `${name}, don't miss out on your cart items!`;
        message = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Hello ${name},</h2>
            <p>We wanted to remind you that you still have some great items waiting in your shopping cart.</p>
            <p>Your carefully selected items are still available, but they might not be in stock for long!</p>
            
            <h3>Your cart: ${items.length} ${
          items.length === 1 ? "item" : "items"
        } - ${formattedTotal}</h3>
            
            <div style="margin: 20px 0;">
              ${itemsHTML}
            </div>
            
            <a href="https://your-website.com/cart" style="display: inline-block; background-color: #ef3c23; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">Complete Your Purchase</a>
            
            <p style="margin-top: 30px; color: #666; font-size: 14px;">If you experienced any issues during checkout, our customer support team is here to help.</p>
          </div>
        `;
        break;

      case 3:
        subject = `SPECIAL OFFER: ${
          discountCode ? "10% OFF" : "Discount"
        } to complete your purchase, ${name}!`;
        message = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Hello ${name},</h2>
            <p>We notice you still have items in your cart, and we'd love to help you complete your purchase.</p>
            
            ${
              discountCode
                ? `<div style="background-color: #f8f8f8; padding: 15px; margin: 20px 0; text-align: center; border: 2px dashed #ef3c23;">
                <h3 style="margin-top: 0; color: #ef3c23;">SPECIAL OFFER</h3>
                <p>Use code <strong style="font-size: 18px;">${discountCode}</strong> for 10% OFF your order!</p>
                <p style="font-size: 12px; margin-bottom: 0;">Valid for 7 days only.</p>
              </div>`
                : ""
            }
            
            <h3>Your cart: ${items.length} ${
          items.length === 1 ? "item" : "items"
        } - ${formattedTotal}</h3>
            
            <div style="margin: 20px 0;">
              ${itemsHTML}
            </div>
            
            <a href="https://your-website.com/cart" style="display: inline-block; background-color: #ef3c23; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">Claim Your ${
              discountCode ? "Discount" : "Cart"
            } Now</a>
            
            <p style="margin-top: 30px; color: #666; font-size: 14px;">We value you as a customer and are here to help with any questions or concerns.</p>
          </div>
        `;
        break;

      default:
        subject = `Items waiting in your cart, ${name}!`;
        message = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Hello ${name},</h2>
            <p>You have items in your cart waiting to be purchased.</p>
            
            <h3>Your cart: ${items.length} ${
          items.length === 1 ? "item" : "items"
        } - ${formattedTotal}</h3>
            
            <div style="margin: 20px 0;">
              ${itemsHTML}
            </div>
            
            <a href="https://your-website.com/cart" style="display: inline-block; background-color: #ef3c23; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">Return to Cart</a>
          </div>
        `;
    }

    return { subject, message };
  }

  /**
   * Send in-app notification about abandoned cart
   * @param {string} userId - User ID
   * @param {number} itemCount - Number of items in cart
   * @param {string} cartId - Cart ID
   * @returns {Promise<Object>} Result of notification creation
   */
  async sendCartReminderNotification(userId, itemCount, cartId) {
    try {
      return await notificationService.createNotification(
        userId,
        "cart_reminder",
        "Your shopping cart is waiting!",
        `You have ${itemCount} ${
          itemCount === 1 ? "item" : "items"
        } in your cart ready for checkout.`,
        "/cart"
      );
    } catch (error) {
      console.error("Error sending cart reminder notification:", error);
      return { success: false };
    }
  }

  /**
   * Get cart recovery statistics for admin dashboard
   * @param {Date} startDate - Start date for reporting
   * @param {Date} endDate - End date for reporting
   * @returns {Promise<Object>} Cart recovery statistics
   */
  async getCartRecoveryStats(startDate = new Date(0), endDate = new Date()) {
    try {
      // Get all abandoned carts in the date range
      const abandonedCartsRef = collection(db, "abandonedCarts");
      const q = query(
        abandonedCartsRef,
        where("createdAt", ">=", startDate),
        where("createdAt", "<=", endDate)
      );

      const snapshot = await getDocs(q);

      // Initialize statistics
      const stats = {
        totalAbandonedCarts: snapshot.size,
        recoveredCarts: 0,
        recoveryRate: 0,
        totalCartValue: 0,
        recoveredCartValue: 0,
        emailsSent: 0,
        emailEffectiveness: {
          emailsSent: 0,
          cartsRecovered: 0,
          conversionRate: 0,
        },
      };

      // Process each cart
      snapshot.forEach((doc) => {
        const cart = doc.data();

        // Calculate cart value
        const cartValue = cart.items.reduce(
          (total, item) => total + item.price * item.quantity,
          0
        );

        stats.totalCartValue += cartValue;
        stats.emailsSent += cart.emailsSent || 0;

        if (cart.recovered) {
          stats.recoveredCarts++;
          stats.recoveredCartValue += cartValue;

          if (cart.emailsSent) {
            stats.emailEffectiveness.emailsSent += cart.emailsSent;
            stats.emailEffectiveness.cartsRecovered++;
          }
        }
      });

      // Calculate rates and percentages
      if (stats.totalAbandonedCarts > 0) {
        stats.recoveryRate =
          (stats.recoveredCarts / stats.totalAbandonedCarts) * 100;
      }

      if (stats.emailEffectiveness.emailsSent > 0) {
        stats.emailEffectiveness.conversionRate =
          (stats.emailEffectiveness.cartsRecovered /
            (stats.emailEffectiveness.emailsSent / 3)) *
          100;
      }

      return {
        success: true,
        stats,
      };
    } catch (error) {
      console.error("Error getting cart recovery stats:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Clean up old abandoned cart records
   * @param {number} daysToKeep - Number of days to keep records
   * @returns {Promise<Object>} Result with count of deleted records
   */
  async cleanupOldRecords(daysToKeep = 90) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const abandonedCartsRef = collection(db, "abandonedCarts");
      const q = query(abandonedCartsRef, where("updatedAt", "<=", cutoffDate));

      const snapshot = await getDocs(q);
      let deletedCount = 0;

      const batch = writeBatch(db);
      snapshot.forEach((doc) => {
        batch.delete(doc.ref);
        deletedCount++;
      });

      if (deletedCount > 0) {
        await batch.commit();
      }

      return { success: true, deletedCount };
    } catch (error) {
      console.error("Error cleaning up old abandoned cart records:", error);
      return { success: false, error: error.message };
    }
  }
}

const cartRecoveryService = new CartRecoveryService();
export default cartRecoveryService;
