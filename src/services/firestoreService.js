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
      return { success: true, data: userData };
    } catch (error) {
      console.error("Error setting user document: ", error);
      return { success: false, error };
    }
  }

  // Get a user by ID
  async getUserById(uid) {
    try {
      const userRef = doc(db, this.collections.USERS, uid);
      const userDoc = await getDoc(userRef);

      if (userDoc.exists()) {
        return { success: true, data: { id: userDoc.id, ...userDoc.data() } };
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
      const productRef = doc(db, this.collections.PRODUCTS, productId);
      const productDoc = await getDoc(productRef);

      if (productDoc.exists()) {
        return {
          success: true,
          data: { id: productDoc.id, ...productDoc.data() },
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

      return {
        success: true,
        data: products,
        lastVisible: lastVisibleDoc,
        hasMore: products.length === pageSize,
      };
    } catch (error) {
      console.error("Error getting products: ", error);
      return { success: false, error };
    }
  }

  // Search products
  async searchProducts(searchTerm) {
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

      return { success: true, data: matchingProducts };
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
      const achievementsRef = collection(db, this.collections.ACHIEVEMENTS);
      const q = query(achievementsRef, orderBy("createdAt"));

      const snapshot = await getDocs(q);

      const achievements = [];
      snapshot.forEach((doc) => {
        achievements.push({ id: doc.id, ...doc.data() });
      });

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

      return { success: true, data: { awarded: true } };
    } catch (error) {
      console.error("Error awarding achievement: ", error);
      return { success: false, error };
    }
  }

  // Get user achievements
  async getUserAchievements(userId) {
    try {
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

      return { success: true, data: userAchievements };
    } catch (error) {
      console.error("Error getting user achievements: ", error);
      return { success: false, error };
    }
  }

  /**
   * ===== CART OPERATIONS =====
   */

  // Get user cart
  async getUserCart(userId) {
    try {
      const cartsRef = collection(db, this.collections.CART);
      const q = query(cartsRef, where("userId", "==", userId));

      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        // Create a new cart if one doesn't exist
        const newCart = {
          userId,
          items: [],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };

        const newCartRef = await addDoc(cartsRef, newCart);
        return {
          success: true,
          data: { id: newCartRef.id, ...newCart, items: [] },
        };
      }

      // Return the first cart found (there should only be one per user)
      const cartDoc = snapshot.docs[0];
      return { success: true, data: { id: cartDoc.id, ...cartDoc.data() } };
    } catch (error) {
      console.error("Error getting user cart: ", error);
      return { success: false, error };
    }
  }

  // Update user cart
  async updateCart(cartId, items) {
    try {
      const cartRef = doc(db, this.collections.CART, cartId);

      await updateDoc(cartRef, {
        items,
        updatedAt: serverTimestamp(),
      });

      return { success: true };
    } catch (error) {
      console.error("Error updating cart: ", error);
      return { success: false, error };
    }
  }

  // Add item to cart
  async addToCart(userId, product, quantity = 1) {
    try {
      // Get the user's cart
      const { success, data: cart, error } = await this.getUserCart(userId);

      if (!success) {
        return { success: false, error };
      }

      const cartItems = cart.items || [];

      // Check if the product is already in the cart
      const existingItemIndex = cartItems.findIndex(
        (item) => item.productId === product.id
      );

      if (existingItemIndex >= 0) {
        // Update quantity
        cartItems[existingItemIndex].quantity += quantity;
      } else {
        // Add new item
        cartItems.push({
          productId: product.id,
          name: product.name,
          price: product.price,
          image: product.image || null,
          quantity,
        });
      }

      // Update the cart
      await this.updateCart(cart.id, cartItems);

      return { success: true, data: { cartId: cart.id, items: cartItems } };
    } catch (error) {
      console.error("Error adding to cart: ", error);
      return { success: false, error };
    }
  }

  /**
   * ===== CATEGORIES OPERATIONS =====
   */

  // Get all categories
  async getCategories() {
    try {
      const categoriesRef = collection(db, this.collections.CATEGORIES);
      const snapshot = await getDocs(categoriesRef);

      const categories = [];
      snapshot.forEach((doc) => {
        categories.push({ id: doc.id, ...doc.data() });
      });

      return { success: true, data: categories };
    } catch (error) {
      console.error("Error getting categories: ", error);
      return { success: false, error };
    }
  }

  /**
   * ===== REVIEW OPERATIONS =====
   */

  // Add a product review
  async addReview(reviewData) {
    try {
      // Add timestamps
      reviewData.createdAt = serverTimestamp();
      reviewData.updatedAt = serverTimestamp();

      const reviewsRef = collection(db, this.collections.REVIEWS);
      const newReviewRef = await addDoc(reviewsRef, reviewData);

      // Update product rating statistics
      await this.updateProductRating(reviewData.productId);

      return {
        success: true,
        data: {
          id: newReviewRef.id,
          ...reviewData,
        },
      };
    } catch (error) {
      console.error("Error adding review: ", error);
      return { success: false, error };
    }
  }

  // Get product reviews
  async getProductReviews(productId) {
    try {
      const reviewsRef = collection(db, this.collections.REVIEWS);
      const q = query(
        reviewsRef,
        where("productId", "==", productId),
        orderBy("createdAt", "desc")
      );

      const snapshot = await getDocs(q);

      const reviews = [];
      snapshot.forEach((doc) => {
        reviews.push({ id: doc.id, ...doc.data() });
      });

      return { success: true, data: reviews };
    } catch (error) {
      console.error("Error getting product reviews: ", error);
      return { success: false, error };
    }
  }

  // Update product rating statistics
  async updateProductRating(productId) {
    try {
      // Get all reviews for this product
      const { success, data: reviews } = await this.getProductReviews(
        productId
      );

      if (!success || reviews.length === 0) {
        return;
      }

      // Calculate average rating
      const totalRating = reviews.reduce(
        (sum, review) => sum + review.rating,
        0
      );
      const averageRating = totalRating / reviews.length;

      // Update product with new rating data
      const productRef = doc(db, this.collections.PRODUCTS, productId);
      await updateDoc(productRef, {
        averageRating,
        reviewCount: reviews.length,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Error updating product rating: ", error);
    }
  }
}

// Create and export a single instance
const firestoreService = new FirestoreService();
export default firestoreService;
