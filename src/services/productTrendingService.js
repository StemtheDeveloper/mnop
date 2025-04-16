import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../config/firebase";

class ProductTrendingService {
  /**
   * Track a view for a product
   * @param {string} productId - The product ID
   * @param {string} userId - The user ID (optional)
   * @returns {Promise<Object>} - Success status
   */
  async trackProductView(productId, userId = null) {
    try {
      const viewData = {
        productId,
        timestamp: serverTimestamp(),
        userId: userId || "anonymous",
        // Add additional info for analytics if needed
        device: this.getDeviceType(),
        referrer: document.referrer || "direct",
      };

      await addDoc(collection(db, "productViews"), viewData);

      return { success: true };
    } catch (error) {
      console.error("Error tracking product view:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get the number of views for a product within a time frame
   * @param {string} productId - The product ID
   * @param {number} days - Number of days to look back
   * @returns {Promise<Object>} - View count or error
   */
  async getProductViewCount(productId, days = 7) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Modified query to avoid composite index requirement
      const viewsRef = collection(db, "productViews");
      let q = query(viewsRef, where("productId", "==", productId));

      const snapshot = await getDocs(q);

      // Filter client-side by timestamp
      const filteredViews = snapshot.docs.filter((doc) => {
        const data = doc.data();
        // Check if timestamp exists and is after startDate
        return (
          data.timestamp &&
          data.timestamp.toDate &&
          data.timestamp.toDate() >= startDate
        );
      });

      return {
        success: true,
        data: {
          count: filteredViews.length,
          timeframe: `${days} days`,
        },
      };
    } catch (error) {
      console.error("Error getting product view count:", error);
      // Return a basic response instead of failing completely
      return {
        success: true,
        data: {
          count: 0,
          timeframe: `${days} days`,
          error: error.message,
        },
      };
    }
  }

  /**
   * Check if a product is trending based on views and investments
   * @param {string} productId - The product ID
   * @returns {Promise<Object>} - Trending status or error
   */
  async checkProductTrendingStatus(productId) {
    try {
      // Get view count
      const { success: viewSuccess, data: viewData } =
        await this.getProductViewCount(productId, 7);

      // Handle the case where we couldn't get view count but don't want to crash
      if (!viewSuccess && !viewData) {
        return {
          success: true,
          data: {
            views: 0,
            isTrending: false,
            needsServerCheck: true,
            error: "Could not fetch view data",
          },
        };
      }

      // The rest of the check will be done on the server-side
      // via the requestDeadlineExtension function
      return {
        success: true,
        data: {
          views: viewData.count,
          isTrending: null, // Will be determined by the server
          needsServerCheck: true,
        },
      };
    } catch (error) {
      console.error("Error checking product trending status:", error);
      // Return a non-failure response to prevent UI from breaking
      return {
        success: true,
        data: {
          views: 0,
          isTrending: false,
          needsServerCheck: true,
          error: error.message,
        },
      };
    }
  }

  /**
   * Request a deadline extension for a trending product
   * @param {string} productId - The product ID
   * @returns {Promise<Object>} - Extension result or error
   */
  async requestDeadlineExtension(productId) {
    try {
      const requestExtension = httpsCallable(
        functions,
        "requestDeadlineExtension"
      );

      const result = await requestExtension({ productId });

      return {
        success: result.data.success,
        data: result.data,
        message: result.data.message,
      };
    } catch (error) {
      console.error("Error requesting deadline extension:", error);
      return {
        success: false,
        error: error.message || "Failed to request deadline extension",
      };
    }
  }

  /**
   * Get device type for analytics
   * @returns {string} - Device type
   */
  getDeviceType() {
    const ua = navigator.userAgent;
    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
      return "tablet";
    }
    if (
      /Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(
        ua
      )
    ) {
      return "mobile";
    }
    return "desktop";
  }
}

const productTrendingService = new ProductTrendingService();
export default productTrendingService;
