// filepath: c:\Users\GGPC\Desktop\mnop-app\src\services\userDataExportService.js
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { unsanitizeObject, securityWarning } from "../utils/unsanitizer";

class UserDataExportService {
  /**
   * Export all user profile data
   * @param {string} userId - User ID
   * @returns {Promise<Object>} User profile data or error
   */
  async exportUserProfile(userId) {
    try {
      const userRef = doc(db, "users", userId);
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) {
        return {
          success: false,
          error: "User not found",
        };
      }

      // Get user profile data but exclude any sensitive fields
      const userData = userDoc.data();
      const { passwordHash, secret, ...exportableData } = userData;

      return {
        success: true,
        data: {
          profile: {
            id: userDoc.id,
            ...exportableData,
          },
        },
      };
    } catch (error) {
      console.error("Error exporting user profile:", error);
      return {
        success: false,
        error: error.message || "Failed to export user profile",
      };
    }
  }

  /**
   * Export user orders history
   * @param {string} userId - User ID
   * @returns {Promise<Object>} User orders or error
   */
  async exportUserOrders(userId) {
    try {
      const ordersRef = collection(db, "orders");
      const q = query(
        ordersRef,
        where("userId", "==", userId),
        orderBy("createdAt", "desc")
      );

      const snapshot = await getDocs(q);
      const orders = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        deliveredAt: doc.data().deliveredAt?.toDate() || null,
        refundDate: doc.data().refundDate?.toDate() || null,
      }));

      return {
        success: true,
        data: { orders },
      };
    } catch (error) {
      console.error("Error exporting user orders:", error);
      return {
        success: false,
        error: error.message || "Failed to export user orders",
      };
    }
  }

  /**
   * Export user transactions history
   * @param {string} userId - User ID
   * @returns {Promise<Object>} User transactions or error
   */
  async exportUserTransactions(userId) {
    try {
      const transactionsRef = collection(db, "transactions");
      const q = query(
        transactionsRef,
        where("userId", "==", userId),
        orderBy("createdAt", "desc")
      );

      const snapshot = await getDocs(q);
      const transactions = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
      }));

      return {
        success: true,
        data: { transactions },
      };
    } catch (error) {
      console.error("Error exporting user transactions:", error);
      return {
        success: false,
        error: error.message || "Failed to export user transactions",
      };
    }
  }

  /**
   * Export user products (for designers)
   * @param {string} userId - User ID
   * @returns {Promise<Object>} User products or error
   */
  async exportUserProducts(userId) {
    try {
      const productsRef = collection(db, "products");
      const q = query(
        productsRef,
        where("designerId", "==", userId),
        orderBy("createdAt", "desc")
      );

      const snapshot = await getDocs(q);
      const products = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
      }));

      return {
        success: true,
        data: { products },
      };
    } catch (error) {
      console.error("Error exporting user products:", error);
      return {
        success: false,
        error: error.message || "Failed to export user products",
      };
    }
  }

  /**
   * Export user investments (for investors)
   * @param {string} userId - User ID
   * @returns {Promise<Object>} User investments or error
   */
  async exportUserInvestments(userId) {
    try {
      const investmentsRef = collection(db, "investments");
      const q = query(
        investmentsRef,
        where("investorId", "==", userId),
        orderBy("createdAt", "desc")
      );

      const snapshot = await getDocs(q);
      const investments = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
      }));

      return {
        success: true,
        data: { investments },
      };
    } catch (error) {
      console.error("Error exporting user investments:", error);
      return {
        success: false,
        error: error.message || "Failed to export user investments",
      };
    }
  }

  /**
   * Export user messages
   * @param {string} userId - User ID
   * @returns {Promise<Object>} User messages or error
   */
  async exportUserMessages(userId) {
    try {
      // Get conversations where the user is a participant
      const conversationsRef = collection(db, "conversations");
      const q = query(
        conversationsRef,
        where("participants", "array-contains", userId)
      );

      const conversationsSnapshot = await getDocs(q);
      const conversations = [];

      // For each conversation, get the messages
      for (const conversationDoc of conversationsSnapshot.docs) {
        const conversationData = conversationDoc.data();
        const messagesRef = collection(
          db,
          "conversations",
          conversationDoc.id,
          "messages"
        );
        const messagesQuery = query(messagesRef, orderBy("timestamp", "asc"));
        const messagesSnapshot = await getDocs(messagesQuery);

        const messages = messagesSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          timestamp: doc.data().timestamp?.toDate() || new Date(),
        }));

        conversations.push({
          id: conversationDoc.id,
          ...conversationData,
          messages: messages,
        });
      }

      return {
        success: true,
        data: { conversations },
      };
    } catch (error) {
      console.error("Error exporting user messages:", error);
      return {
        success: false,
        error: error.message || "Failed to export user messages",
      };
    }
  }

  /**
   * Export user reviews
   * @param {string} userId - User ID
   * @returns {Promise<Object>} User reviews or error
   */
  async exportUserReviews(userId) {
    try {
      // Get reviews written by the user
      const reviewsRef = collection(db, "reviews");
      const q = query(
        reviewsRef,
        where("userId", "==", userId),
        orderBy("createdAt", "desc")
      );

      const snapshot = await getDocs(q);
      const reviews = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
      }));

      // Get reviews about the user's products (if they're a designer)
      const productReviewsRef = collection(db, "reviews");
      const productsRef = collection(db, "products");
      const productsQuery = query(
        productsRef,
        where("designerId", "==", userId)
      );
      const productsSnapshot = await getDocs(productsQuery);
      const productIds = productsSnapshot.docs.map((doc) => doc.id);

      let productReviews = [];
      if (productIds.length > 0) {
        for (const productId of productIds) {
          const productReviewsQuery = query(
            reviewsRef,
            where("productId", "==", productId),
            orderBy("createdAt", "desc")
          );
          const productReviewsSnapshot = await getDocs(productReviewsQuery);

          productReviews = [
            ...productReviews,
            ...productReviewsSnapshot.docs.map((doc) => ({
              id: doc.id,
              ...doc.data(),
              createdAt: doc.data().createdAt?.toDate() || new Date(),
            })),
          ];
        }
      }

      return {
        success: true,
        data: {
          writtenReviews: reviews,
          receivedReviews: productReviews,
        },
      };
    } catch (error) {
      console.error("Error exporting user reviews:", error);
      return {
        success: false,
        error: error.message || "Failed to export user reviews",
      };
    }
  }

  /**
   * Export all user data
   * This is the main function that combines all the individual data exports
   * @param {string} userId - User ID
   * @param {Object} options - Export options like what data to include
   * @returns {Promise<Object>} All user data or error
   */
  async exportAllUserData(userId, options = {}) {
    try {
      const result = {
        success: true,
        data: {},
        exportDate: new Date(),
      };

      // Check if user exists
      const userRef = doc(db, "users", userId);
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) {
        return {
          success: false,
          error: "User not found",
        };
      }

      // User profile data is always included
      const profileResult = await this.exportUserProfile(userId);
      if (profileResult.success) {
        result.data.profile = profileResult.data.profile;
      } else {
        console.error("Error exporting user profile:", profileResult.error);
      }

      // Include orders if option is not explicitly set to false
      if (options.includeOrders !== false) {
        const ordersResult = await this.exportUserOrders(userId);
        if (ordersResult.success) {
          result.data.orders = ordersResult.data.orders;
        } else {
          console.error("Error exporting orders:", ordersResult.error);
        }
      }

      // Include transactions if option is not explicitly set to false
      if (options.includeTransactions !== false) {
        const transactionsResult = await this.exportUserTransactions(userId);
        if (transactionsResult.success) {
          result.data.transactions = transactionsResult.data.transactions;
        } else {
          console.error(
            "Error exporting transactions:",
            transactionsResult.error
          );
        }
      }

      // Include products if the user is a designer
      if (options.includeProducts !== false) {
        const userData = userDoc.data();
        const roles = Array.isArray(userData.roles)
          ? userData.roles
          : [userData.role];

        if (roles.includes("designer")) {
          const productsResult = await this.exportUserProducts(userId);
          if (productsResult.success) {
            result.data.products = productsResult.data.products;
          } else {
            console.error("Error exporting products:", productsResult.error);
          }
        }
      }

      // Include investments if the user is an investor
      if (options.includeInvestments !== false) {
        const userData = userDoc.data();
        const roles = Array.isArray(userData.roles)
          ? userData.roles
          : [userData.role];

        if (roles.includes("investor")) {
          const investmentsResult = await this.exportUserInvestments(userId);
          if (investmentsResult.success) {
            result.data.investments = investmentsResult.data.investments;
          } else {
            console.error(
              "Error exporting investments:",
              investmentsResult.error
            );
          }
        }
      }

      // Include messages if option is not explicitly set to false
      if (options.includeMessages !== false) {
        const messagesResult = await this.exportUserMessages(userId);
        if (messagesResult.success) {
          result.data.conversations = messagesResult.data.conversations;
        } else {
          console.error("Error exporting messages:", messagesResult.error);
        }
      }

      // Include reviews if option is not explicitly set to false
      if (options.includeReviews !== false) {
        const reviewsResult = await this.exportUserReviews(userId);
        if (reviewsResult.success) {
          result.data.writtenReviews = reviewsResult.data.writtenReviews;
          result.data.receivedReviews = reviewsResult.data.receivedReviews;
        } else {
          console.error("Error exporting reviews:", reviewsResult.error);
        }
      }

      return result;
    } catch (error) {
      console.error("Error exporting all user data:", error);
      return {
        success: false,
        error: error.message || "Failed to export user data",
      };
    }
  }

  /**
   * Export user data as JSON file for download
   * @param {string} userId - User ID
   * @param {Object} options - Export options
   * @returns {Blob} JSON file data as blob
   */
  async exportDataAsJsonFile(userId, options = {}) {
    try {
      const result = await this.exportAllUserData(userId, options);

      if (!result.success) {
        throw new Error(result.error || "Failed to export data");
      }

      // Unsanitize the data before export
      const unsanitizedData = unsanitizeObject(result.data);

      // Add security warning to the export
      unsanitizedData._securityWarning = securityWarning();

      // Convert data to formatted JSON string
      const jsonData = JSON.stringify(unsanitizedData, null, 2);

      // Create blob from JSON string
      const blob = new Blob([jsonData], { type: "application/json" });

      return {
        success: true,
        data: blob,
        filename: `user_data_export_${userId.substring(0, 6)}_${
          new Date().toISOString().split("T")[0]
        }.json`,
      };
    } catch (error) {
      console.error("Error creating JSON export:", error);
      return {
        success: false,
        error: error.message || "Failed to create JSON export",
      };
    }
  }

  /**
   * Export user data as CSV files (creates a zip file containing multiple CSVs)
   * @param {string} userId - User ID
   * @param {Object} options - Export options
   * @returns {Promise<Object>} Result containing Blob if successful
   */
  async exportDataAsCsvFiles(userId, options = {}) {
    try {
      // Import JSZip dynamically
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();

      const result = await this.exportAllUserData(userId, options);

      if (!result.success) {
        throw new Error(result.error || "Failed to export data");
      }

      // Helper function to convert object array to CSV
      const arrayToCsv = (data) => {
        if (!data || !data.length) return "";

        // Get headers from the first item
        const headers = Object.keys(data[0]).filter(
          (key) =>
            typeof data[0][key] !== "object" || data[0][key] instanceof Date
        );

        // Create header row
        let csv = headers.join(",") + "\n";

        // Add data rows
        data.forEach((item) => {
          const row = headers.map((header) => {
            let value = item[header];

            // Format dates
            if (value instanceof Date) {
              value = value.toISOString();
            }

            // Format values for CSV
            if (value === null || value === undefined) {
              return "";
            } else if (typeof value === "string") {
              return `"${value.replace(/"/g, '""')}"`;
            } else {
              return String(value);
            }
          });

          csv += row.join(",") + "\n";
        });

        return csv;
      };

      // Add user profile CSV
      if (result.data.profile) {
        const profileCsv = arrayToCsv([result.data.profile]);
        zip.file("profile.csv", profileCsv);
      }

      // Add orders CSV
      if (result.data.orders && result.data.orders.length) {
        const ordersCsv = arrayToCsv(
          result.data.orders.map((order) => {
            // Flatten the order object for CSV
            const { items, shippingInfo, ...orderData } = order;
            return {
              ...orderData,
              itemCount: items ? items.length : 0,
              shippingName: shippingInfo?.fullName || "",
              shippingAddress: shippingInfo?.address || "",
              shippingCity: shippingInfo?.city || "",
              shippingState: shippingInfo?.state || "",
              shippingZip: shippingInfo?.zipCode || "",
              shippingCountry: shippingInfo?.country || "",
            };
          })
        );
        zip.file("orders.csv", ordersCsv);
      }

      // Add transactions CSV
      if (result.data.transactions && result.data.transactions.length) {
        const transactionsCsv = arrayToCsv(result.data.transactions);
        zip.file("transactions.csv", transactionsCsv);
      }

      // Add products CSV
      if (result.data.products && result.data.products.length) {
        const productsCsv = arrayToCsv(
          result.data.products.map((product) => {
            const { imageUrls, categories, ...productData } = product;
            return {
              ...productData,
              categoriesString: categories ? categories.join(";") : "",
              imageCount: imageUrls ? imageUrls.length : 0,
            };
          })
        );
        zip.file("products.csv", productsCsv);
      }

      // Add investments CSV
      if (result.data.investments && result.data.investments.length) {
        const investmentsCsv = arrayToCsv(result.data.investments);
        zip.file("investments.csv", investmentsCsv);
      }

      // Add reviews CSV
      if (result.data.writtenReviews && result.data.writtenReviews.length) {
        const reviewsCsv = arrayToCsv(result.data.writtenReviews);
        zip.file("written_reviews.csv", reviewsCsv);
      }

      if (result.data.receivedReviews && result.data.receivedReviews.length) {
        const receivedReviewsCsv = arrayToCsv(result.data.receivedReviews);
        zip.file("received_reviews.csv", receivedReviewsCsv);
      }

      // Generate zip file
      const zipBlob = await zip.generateAsync({ type: "blob" });

      return {
        success: true,
        data: zipBlob,
        filename: `user_data_export_${userId.substring(0, 6)}_${
          new Date().toISOString().split("T")[0]
        }.zip`,
      };
    } catch (error) {
      console.error("Error creating CSV export:", error);
      return {
        success: false,
        error: error.message || "Failed to create CSV export",
      };
    }
  }
}

export default new UserDataExportService();
