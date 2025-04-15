import {
  doc,
  getDoc,
  updateDoc,
  arrayUnion,
  collection,
  query,
  getDocs,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../config/firebase";

class AchievementService {
  // Define achievement IDs
  static ACHIEVEMENTS = {
    FIRST_PRODUCT: "first_product",
    PRODUCT_COLLECTOR_5: "product_collector_5",
    PRODUCT_COLLECTOR_10: "product_collector_10",
    PRODUCT_COLLECTOR_25: "product_collector_25",
    FIRST_INVESTMENT: "first_investment",
    INVESTOR_3: "investor_3",
    INVESTOR_10: "investor_10",
    FIRST_SALE: "first_sale",
    SALES_MASTER_5: "sales_master_5",
    SALES_MASTER_25: "sales_master_25",
    TOP_SELLER: "top_seller",
    FIRST_REVIEW: "first_review",
    REVIEWER_5: "reviewer_5",
    FIRST_QUOTE: "first_manufacturing_quote",
    QUOTE_MASTER_5: "quote_master_5",
    PROJECT_COMPLETE: "first_completed_project",
    VETERAN_USER: "veteran_user", // 3 months active
  };

  /**
   * Check and update product-related achievements
   * @param {string} userId - User ID
   * @returns {Promise<{ earnedIds: string[] }>} - Earned achievement IDs
   */
  static async checkProductAchievements(userId) {
    try {
      // Count user's products
      const productsRef = collection(db, "products");
      const productsQuery = query(
        productsRef,
        where("designerId", "==", userId)
      );
      const productsSnapshot = await getDocs(productsQuery);
      const productCount = productsSnapshot.size;

      // Get current user achievements
      const userRef = doc(db, "users", userId);
      const userDoc = await getDoc(userRef);
      const userData = userDoc.data();
      const currentAchievements = userData.achievements || [];

      const earnedIds = [];

      // Check first product achievement
      if (
        productCount >= 1 &&
        !currentAchievements.includes(this.ACHIEVEMENTS.FIRST_PRODUCT)
      ) {
        earnedIds.push(this.ACHIEVEMENTS.FIRST_PRODUCT);
      }

      // Check for 5 products achievement
      if (
        productCount >= 5 &&
        !currentAchievements.includes(this.ACHIEVEMENTS.PRODUCT_COLLECTOR_5)
      ) {
        earnedIds.push(this.ACHIEVEMENTS.PRODUCT_COLLECTOR_5);
      }

      // Check for 10 products achievement
      if (
        productCount >= 10 &&
        !currentAchievements.includes(this.ACHIEVEMENTS.PRODUCT_COLLECTOR_10)
      ) {
        earnedIds.push(this.ACHIEVEMENTS.PRODUCT_COLLECTOR_10);
      }

      // Check for 25 products achievement
      if (
        productCount >= 25 &&
        !currentAchievements.includes(this.ACHIEVEMENTS.PRODUCT_COLLECTOR_25)
      ) {
        earnedIds.push(this.ACHIEVEMENTS.PRODUCT_COLLECTOR_25);
      }

      // Award achievements if earned
      if (earnedIds.length > 0) {
        await this.awardAchievements(userId, earnedIds);
      }

      return { earnedIds };
    } catch (error) {
      console.error("Error checking product achievements:", error);
      return { earnedIds: [] };
    }
  }

  /**
   * Check and update investment-related achievements
   * @param {string} userId - User ID
   * @returns {Promise<{ earnedIds: string[] }>} - Earned achievement IDs
   */
  static async checkInvestmentAchievements(userId) {
    try {
      // Count user's investments
      const investmentsRef = collection(db, "investments");
      const investmentsQuery = query(
        investmentsRef,
        where("userId", "==", userId)
      );
      const investmentsSnapshot = await getDocs(investmentsQuery);
      const investmentCount = investmentsSnapshot.size;

      // Get current user achievements
      const userRef = doc(db, "users", userId);
      const userDoc = await getDoc(userRef);
      const userData = userDoc.data();
      const currentAchievements = userData.achievements || [];

      const earnedIds = [];

      // Check first investment achievement
      if (
        investmentCount >= 1 &&
        !currentAchievements.includes(this.ACHIEVEMENTS.FIRST_INVESTMENT)
      ) {
        earnedIds.push(this.ACHIEVEMENTS.FIRST_INVESTMENT);
      }

      // Check for 3 investments achievement
      if (
        investmentCount >= 3 &&
        !currentAchievements.includes(this.ACHIEVEMENTS.INVESTOR_3)
      ) {
        earnedIds.push(this.ACHIEVEMENTS.INVESTOR_3);
      }

      // Check for 10 investments achievement
      if (
        investmentCount >= 10 &&
        !currentAchievements.includes(this.ACHIEVEMENTS.INVESTOR_10)
      ) {
        earnedIds.push(this.ACHIEVEMENTS.INVESTOR_10);
      }

      // Award achievements if earned
      if (earnedIds.length > 0) {
        await this.awardAchievements(userId, earnedIds);
      }

      return { earnedIds };
    } catch (error) {
      console.error("Error checking investment achievements:", error);
      return { earnedIds: [] };
    }
  }

  /**
   * Check and update quote-related achievements
   * @param {string} userId - User ID
   * @returns {Promise<{ earnedIds: string[] }>} - Earned achievement IDs
   */
  static async checkQuoteAchievements(userId) {
    try {
      // Count quotes submitted by user
      const quotesRef = collection(db, "manufacturerQuotes");
      const quotesQuery = query(
        quotesRef,
        where("manufacturerId", "==", userId)
      );
      const quotesSnapshot = await getDocs(quotesQuery);
      const quoteCount = quotesSnapshot.size;

      // Get count of completed projects
      const completedQuery = query(
        quotesRef,
        where("manufacturerId", "==", userId),
        where("status", "==", "completed")
      );
      const completedSnapshot = await getDocs(completedQuery);
      const completedCount = completedSnapshot.size;

      // Get current user achievements
      const userRef = doc(db, "users", userId);
      const userDoc = await getDoc(userRef);
      const userData = userDoc.data();
      const currentAchievements = userData.achievements || [];

      const earnedIds = [];

      // Check first quote achievement
      if (
        quoteCount >= 1 &&
        !currentAchievements.includes(this.ACHIEVEMENTS.FIRST_QUOTE)
      ) {
        earnedIds.push(this.ACHIEVEMENTS.FIRST_QUOTE);
      }

      // Check for 5 quotes achievement
      if (
        quoteCount >= 5 &&
        !currentAchievements.includes(this.ACHIEVEMENTS.QUOTE_MASTER_5)
      ) {
        earnedIds.push(this.ACHIEVEMENTS.QUOTE_MASTER_5);
      }

      // Check for completed project achievement
      if (
        completedCount >= 1 &&
        !currentAchievements.includes(this.ACHIEVEMENTS.PROJECT_COMPLETE)
      ) {
        earnedIds.push(this.ACHIEVEMENTS.PROJECT_COMPLETE);
      }

      // Award achievements if earned
      if (earnedIds.length > 0) {
        await this.awardAchievements(userId, earnedIds);
      }

      return { earnedIds };
    } catch (error) {
      console.error("Error checking quote achievements:", error);
      return { earnedIds: [] };
    }
  }

  /**
   * Check and update review-related achievements
   * @param {string} userId - User ID
   * @returns {Promise<{ earnedIds: string[] }>} - Earned achievement IDs
   */
  static async checkReviewAchievements(userId) {
    try {
      // Count user's reviews
      const reviewsRef = collection(db, "reviews");
      const reviewsQuery = query(reviewsRef, where("userId", "==", userId));
      const reviewsSnapshot = await getDocs(reviewsQuery);
      const reviewCount = reviewsSnapshot.size;

      // Get current user achievements
      const userRef = doc(db, "users", userId);
      const userDoc = await getDoc(userRef);
      const userData = userDoc.data();
      const currentAchievements = userData.achievements || [];

      const earnedIds = [];

      // Check first review achievement
      if (
        reviewCount >= 1 &&
        !currentAchievements.includes(this.ACHIEVEMENTS.FIRST_REVIEW)
      ) {
        earnedIds.push(this.ACHIEVEMENTS.FIRST_REVIEW);
      }

      // Check for 5 reviews achievement
      if (
        reviewCount >= 5 &&
        !currentAchievements.includes(this.ACHIEVEMENTS.REVIEWER_5)
      ) {
        earnedIds.push(this.ACHIEVEMENTS.REVIEWER_5);
      }

      // Award achievements if earned
      if (earnedIds.length > 0) {
        await this.awardAchievements(userId, earnedIds);
      }

      return { earnedIds };
    } catch (error) {
      console.error("Error checking review achievements:", error);
      return { earnedIds: [] };
    }
  }

  /**
   * Check for veteran user achievement (account age > 3 months)
   * @param {string} userId - User ID
   * @returns {Promise<{ earnedIds: string[] }>} - Earned achievement IDs
   */
  static async checkAccountAgeAchievements(userId) {
    try {
      // Get user document
      const userRef = doc(db, "users", userId);
      const userDoc = await getDoc(userRef);
      const userData = userDoc.data();

      if (!userData) {
        return { earnedIds: [] };
      }

      const currentAchievements = userData.achievements || [];
      const creationTime = userData.createdAt;

      // If no creation time or already has achievement, skip
      if (
        !creationTime ||
        currentAchievements.includes(this.ACHIEVEMENTS.VETERAN_USER)
      ) {
        return { earnedIds: [] };
      }

      const earnedIds = [];
      const now = new Date();
      const accountCreationDate = creationTime.toDate
        ? creationTime.toDate()
        : new Date(creationTime);

      // Check if account is at least 3 months old (90 days)
      const daysSinceCreation =
        (now - accountCreationDate) / (1000 * 60 * 60 * 24);
      if (daysSinceCreation >= 90) {
        earnedIds.push(this.ACHIEVEMENTS.VETERAN_USER);
      }

      // Award achievements if earned
      if (earnedIds.length > 0) {
        await this.awardAchievements(userId, earnedIds);
      }

      return { earnedIds };
    } catch (error) {
      console.error("Error checking account age achievements:", error);
      return { earnedIds: [] };
    }
  }

  /**
   * Award achievements to user
   * @param {string} userId - User ID
   * @param {string[]} achievementIds - Array of achievement IDs to award
   * @returns {Promise<void>}
   */
  static async awardAchievements(userId, achievementIds) {
    try {
      if (!achievementIds || achievementIds.length === 0) {
        return;
      }

      // Update user document with achievements
      const userRef = doc(db, "users", userId);
      await updateDoc(userRef, {
        achievements: arrayUnion(...achievementIds),
        lastAchievementAt: serverTimestamp(),
      });

      // Record achievement events
      const batch = [];
      const now = serverTimestamp();

      achievementIds.forEach((achievementId) => {
        batch.push({
          userId,
          achievementId,
          earnedAt: now,
          type: "achievement_earned",
        });
      });

      // Could add notifications or other actions here

      return { success: true, awarded: achievementIds };
    } catch (error) {
      console.error("Error awarding achievements:", error);
      return { success: false, error };
    }
  }
}

export default AchievementService;
