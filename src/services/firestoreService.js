import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  arrayUnion,
  arrayRemove,
  increment,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../config/firebase";
import cacheService from "./cacheService";

/**
 * Firestore Database Service
 * Handles database operations for users, products, investments, and transactions
 */
class FirestoreService {
  // Collection names
  collections = {
    USERS: "users",
    PRODUCTS: "products",
    INVESTMENTS: "investments",
    TRANSACTIONS: "transactions",
    ORDERS: "orders",
    ACHIEVEMENTS: "achievements",
    CATEGORIES: "categories",
    REVIEWS: "reviews",
    CART: "carts",
  };

  /**
   * ===== USER OPERATIONS =====
   */

  // Create or update a user document
  async setUser(uid, userData) {
    try {
      const userRef = doc(db, this.collections.USERS, uid);
      // Add timestamp for new users
      if (!userData.createdAt) {
        userData.createdAt = serverTimestamp();
      }
      userData.updatedAt = serverTimestamp();

      await setDoc(userRef, userData, { merge: true });

      // Invalidate user cache after update
      cacheService.remove(`user_${uid}`);

      return { success: true, data: userData };
    } catch (error) {
      console.error("Error setting user document: ", error);
      return { success: false, error };
    }
  }

  // Get a user by ID
  async getUserById(uid) {
    try {
      // Check cache first
      const cacheKey = `user_${uid}`;
      const cachedUser = cacheService.get(cacheKey);

      if (cachedUser) {
        return { success: true, data: cachedUser };
      }

      // If not in cache, fetch from firestore
      const userRef = doc(db, this.collections.USERS, uid);
      const userDoc = await getDoc(userRef);

      if (userDoc.exists()) {
        const userData = { id: userDoc.id, ...userDoc.data() };

        // Cache the result for future use - 10 minute TTL
        cacheService.set(cacheKey, userData, "users", 10 * 60 * 1000);

        return { success: true, data: userData };
      } else {
        return { success: false, error: "User not found" };
      }
    } catch (error) {
      console.error("Error getting user document: ", error);
      return { success: false, error };
    }
  }

  // Update user profile
  async updateUserProfile(uid, profileData) {
    try {
      const userRef = doc(db, this.collections.USERS, uid);

      // Add updated timestamp
      profileData.updatedAt = serverTimestamp();

      await updateDoc(userRef, profileData);

      // Invalidate user cache after update
      cacheService.remove(`user_${uid}`);

      return { success: true };
    } catch (error) {
      console.error("Error updating user profile: ", error);
      return { success: false, error };
    }
  }

  /**
   * ===== PRODUCT OPERATIONS =====
   */

  // Add a new product
  async addProduct(productData) {
    try {
      // Add timestamps
      productData.createdAt = serverTimestamp();
      productData.updatedAt = serverTimestamp();

      const productsRef = collection(db, this.collections.PRODUCTS);
      const newProductRef = await addDoc(productsRef, productData);

      // Invalidate products list cache
      cacheService.clearCategory("products");

      return {
        success: true,
        data: {
          id: newProductRef.id,
          ...productData,
        },
      };
    } catch (error) {
      console.error("Error adding product: ", error);
      return { success: false, error };
    }
  }

  // Get a product by ID
  async getProductById(productId) {
    try {
      // Check cache first
      const cacheKey = `product_${productId}`;
      const cachedProduct = cacheService.get(cacheKey);

      if (cachedProduct) {
        return { success: true, data: cachedProduct };
      }

      // If not in cache, fetch from firestore
      const productRef = doc(db, this.collections.PRODUCTS, productId);
      const productDoc = await getDoc(productRef);

      if (productDoc.exists()) {
        const productData = { id: productDoc.id, ...productDoc.data() };

        // Cache the result - 5 minute TTL (default)
        cacheService.set(cacheKey, productData, "products");

        return {
          success: true,
          data: productData,
        };
      } else {
        return { success: false, error: "Product not found" };
      }
    } catch (error) {
      console.error("Error getting product: ", error);
      return { success: false, error };
    }
  }

  // Update a product
  async updateProduct(productId, productData) {
    try {
      const productRef = doc(db, this.collections.PRODUCTS, productId);

      // Add updated timestamp
      productData.updatedAt = serverTimestamp();

      await updateDoc(productRef, productData);

      // Invalidate related caches
      cacheService.remove(`product_${productId}`);

      // Clear category caches that might contain this product
      cacheService.removePattern(/^products_/);

      return { success: true };
    } catch (error) {
      console.error("Error updating product: ", error);
      return { success: false, error };
    }
  }

  // Delete a product
  async deleteProduct(productId) {
    try {
      const productRef = doc(db, this.collections.PRODUCTS, productId);
      await deleteDoc(productRef);

      // Invalidate related caches
      cacheService.remove(`product_${productId}`);
      cacheService.removePattern(/^products_/);

      return { success: true };
    } catch (error) {
      console.error("Error deleting product: ", error);
      return { success: false, error };
    }
  }

  // Get all products with pagination
  async getProducts(options = {}) {
    try {
      const {
        category = null,
        sortBy = "createdAt",
        sortDirection = "desc",
        pageSize = 10,
        lastVisible = null,
      } = options;

      // Generate cache key based on query parameters
      const cacheKey = `products_${
        category || "all"
      }_${sortBy}_${sortDirection}_${pageSize}_${
        lastVisible ? "page" + lastVisible.id : "page1"
      }`;

      // Check cache first, but only for first page and if no special filters
      if (!lastVisible) {
        const cachedProducts = cacheService.get(cacheKey);
        if (cachedProducts) {
          return cachedProducts;
        }
      }

      // If not in cache or pagination, fetch from firestore
      let productsRef = collection(db, this.collections.PRODUCTS);
      let productsQuery;

      // Apply filters
      if (category) {
        productsQuery = query(
          productsRef,
          where("category", "==", category),
          orderBy(sortBy, sortDirection)
        );
      } else {
        productsQuery = query(productsRef, orderBy(sortBy, sortDirection));
      }

      // Apply pagination
      if (lastVisible) {
        productsQuery = query(
          productsQuery,
          startAfter(lastVisible),
          limit(pageSize)
        );
      } else {
        productsQuery = query(productsQuery, limit(pageSize));
      }

      const snapshot = await getDocs(productsQuery);

      const products = [];
      snapshot.forEach((doc) => {
        products.push({ id: doc.id, ...doc.data() });
      });

      // Get last visible document for pagination
      const lastVisibleDoc = snapshot.docs[snapshot.docs.length - 1];

      const result = {
        success: true,
        data: products,
        lastVisible: lastVisibleDoc,
        hasMore: products.length === pageSize,
      };

      // Cache first page results only to avoid caching too much pagination data
      if (!lastVisible) {
        cacheService.set(cacheKey, result, "products", 2 * 60 * 1000); // 2 minutes TTL for product lists
      }

      return result;
    } catch (error) {
      console.error("Error getting products: ", error);
      return { success: false, error };
    }
  }

  // Search products
  async searchProducts(searchTerm) {
    // Search is a special case, only cache very common searches
    const cacheKey = `search_${searchTerm.toLowerCase().trim()}`;
    const cachedResults = cacheService.get(cacheKey);

    if (cachedResults) {
      return cachedResults;
    }

    try {
      // Note: For complex search functionality, consider using Firebase Extensions
      // like Algolia Search or implementing a custom search solution.
      // This is a basic implementation that searches product names and descriptions.

      const productsRef = collection(db, this.collections.PRODUCTS);
      const snapshot = await getDocs(productsRef);

      const searchTermLower = searchTerm.toLowerCase();

      const matchingProducts = [];
      snapshot.forEach((doc) => {
        const product = { id: doc.id, ...doc.data() };

        // Check if name or description contains the search term
        if (
          product.name?.toLowerCase().includes(searchTermLower) ||
          product.description?.toLowerCase().includes(searchTermLower)
        ) {
          matchingProducts.push(product);
        }
      });

      const result = { success: true, data: matchingProducts };

      // Cache search results, but with a shorter TTL
      cacheService.set(cacheKey, result, "searches", 60 * 1000); // 1 minute TTL for searches

      return result;
    } catch (error) {
      console.error("Error searching products: ", error);
      return { success: false, error };
    }
  }

  /**
   * ===== ORDER OPERATIONS =====
   */

  // Create a new order
  async createOrder(orderData) {
    try {
      // Add timestamps and status
      orderData.createdAt = serverTimestamp();
      orderData.updatedAt = serverTimestamp();
      if (!orderData.status) {
        orderData.status = "pending";
      }

      const ordersRef = collection(db, this.collections.ORDERS);
      const newOrderRef = await addDoc(ordersRef, orderData);

      return {
        success: true,
        data: {
          id: newOrderRef.id,
          ...orderData,
        },
      };
    } catch (error) {
      console.error("Error creating order: ", error);
      return { success: false, error };
    }
  }

  // Get an order by ID
  async getOrderById(orderId) {
    try {
      const orderRef = doc(db, this.collections.ORDERS, orderId);
      const orderDoc = await getDoc(orderRef);

      if (orderDoc.exists()) {
        return { success: true, data: { id: orderDoc.id, ...orderDoc.data() } };
      } else {
        return { success: false, error: "Order not found" };
      }
    } catch (error) {
      console.error("Error getting order: ", error);
      return { success: false, error };
    }
  }

  // Update order status
  async updateOrderStatus(orderId, status) {
    try {
      const orderRef = doc(db, this.collections.ORDERS, orderId);

      await updateDoc(orderRef, {
        status,
        updatedAt: serverTimestamp(),
      });

      return { success: true };
    } catch (error) {
      console.error("Error updating order status: ", error);
      return { success: false, error };
    }
  }

  // Get user orders
  async getUserOrders(userId) {
    try {
      const ordersRef = collection(db, this.collections.ORDERS);
      const q = query(
        ordersRef,
        where("userId", "==", userId),
        orderBy("createdAt", "desc")
      );

      const snapshot = await getDocs(q);

      const orders = [];
      snapshot.forEach((doc) => {
        orders.push({ id: doc.id, ...doc.data() });
      });

      return { success: true, data: orders };
    } catch (error) {
      console.error("Error getting user orders: ", error);
      return { success: false, error };
    }
  }

  /**
   * ===== ACHIEVEMENT OPERATIONS =====
   */

  // Add or update achievement
  async setAchievement(achievementData) {
    try {
      const { id } = achievementData;
      let achievementRef;

      if (id) {
        // Update existing achievement
        achievementRef = doc(db, this.collections.ACHIEVEMENTS, id);
        achievementData.updatedAt = serverTimestamp();
        await updateDoc(achievementRef, achievementData);
      } else {
        // Create new achievement
        achievementData.createdAt = serverTimestamp();
        achievementData.updatedAt = serverTimestamp();
        const achievementsRef = collection(db, this.collections.ACHIEVEMENTS);
        const newAchievementRef = await addDoc(
          achievementsRef,
          achievementData
        );
        achievementRef = newAchievementRef;
        achievementData.id = newAchievementRef.id;
      }

      return { success: true, data: achievementData };
    } catch (error) {
      console.error("Error setting achievement: ", error);
      return { success: false, error };
    }
  }

  // Get all achievements
  async getAllAchievements() {
    try {
      // Check cache first as achievements don't change often
      const cacheKey = "all_achievements";
      const cachedAchievements = cacheService.get(cacheKey);

      if (cachedAchievements) {
        return { success: true, data: cachedAchievements };
      }

      const achievementsRef = collection(db, this.collections.ACHIEVEMENTS);
      const q = query(achievementsRef, orderBy("createdAt"));

      const snapshot = await getDocs(q);

      const achievements = [];
      snapshot.forEach((doc) => {
        achievements.push({ id: doc.id, ...doc.data() });
      });

      // Cache achievements for longer period as they rarely change
      cacheService.set(cacheKey, achievements, "achievements", 60 * 60 * 1000); // 60 minute TTL

      return { success: true, data: achievements };
    } catch (error) {
      console.error("Error getting achievements: ", error);
      return { success: false, error };
    }
  }

  // Award achievement to user
  async awardAchievementToUser(userId, achievementId) {
    try {
      const userRef = doc(db, this.collections.USERS, userId);

      // First, check if user already has this achievement
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) {
        return { success: false, error: "User not found" };
      }

      const userData = userDoc.data();
      const userAchievements = userData.achievements || [];

      // If user already has this achievement, return early
      if (userAchievements.includes(achievementId)) {
        return { success: true, data: { alreadyAwarded: true } };
      }

      // Add achievement to user's collection
      await updateDoc(userRef, {
        achievements: arrayUnion(achievementId),
        updatedAt: serverTimestamp(),
      });

      // Invalidate relevant caches
      cacheService.remove(`user_${userId}`);
      cacheService.remove(`user_achievements_${userId}`);

      return { success: true, data: { awarded: true } };
    } catch (error) {
      console.error("Error awarding achievement: ", error);
      return { success: false, error };
    }
  }

  // Get user achievements
  async getUserAchievements(userId) {
    try {
      // Check cache first
      const cacheKey = `user_achievements_${userId}`;
      const cachedAchievements = cacheService.get(cacheKey);

      if (cachedAchievements) {
        return { success: true, data: cachedAchievements };
      }

      const userRef = doc(db, this.collections.USERS, userId);
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) {
        return { success: false, error: "User not found" };
      }

      const userData = userDoc.data();
      const achievementIds = userData.achievements || [];

      if (achievementIds.length === 0) {
        return { success: true, data: [] };
      }

      // Get all achievements
      const { success, data: allAchievements } =
        await this.getAllAchievements();

      if (!success) {
        return { success: false, error: "Failed to fetch achievements" };
      }

      // Filter to only user's achievements
      const userAchievements = allAchievements.filter((achievement) =>
        achievementIds.includes(achievement.id)
      );

      // Cache the user achievements for 15 minutes
      cacheService.set(
        cacheKey,
        userAchievements,
        "user_achievements",
        15 * 60 * 1000
      );

      return { success: true, data: userAchievements };
    } catch (error) {
      console.error("Error getting user achievements: ", error);
      return { success: false, error };
    }
  }
}
export default new FirestoreService();
