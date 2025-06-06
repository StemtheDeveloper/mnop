import { db } from "../config/firebase";
import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
  arrayUnion,
} from "firebase/firestore";

/**
 * Service for managing achievements, including CRUD operations and condition evaluation
 */
export const achievementService = {
  /**
   * Get all achievements from Firestore
   */
  async getAllAchievements() {
    try {
      const achievementsRef = collection(db, "achievements");
      const snapshot = await getDocs(achievementsRef);

      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
    } catch (error) {
      console.error("Error fetching achievements:", error);
      throw error;
    }
  },

  /**
   * Get a specific achievement by ID
   */
  async getAchievementById(achievementId) {
    try {
      const achievementRef = doc(db, "achievements", achievementId);
      const achievementSnap = await getDoc(achievementRef);

      if (!achievementSnap.exists()) {
        throw new Error("Achievement not found");
      }

      return {
        id: achievementSnap.id,
        ...achievementSnap.data(),
      };
    } catch (error) {
      console.error(`Error fetching achievement ${achievementId}:`, error);
      throw error;
    }
  },

  /**
   * Create a new achievement
   */
  async createAchievement(achievementData) {
    try {
      const achievementsRef = collection(db, "achievements");
      const newAchievementData = {
        ...achievementData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const newAchievementRef = await addDoc(
        achievementsRef,
        newAchievementData
      );
      return {
        id: newAchievementRef.id,
        ...newAchievementData,
      };
    } catch (error) {
      console.error("Error creating achievement:", error);
      throw error;
    }
  },

  /**
   * Update an existing achievement
   */
  async updateAchievement(achievementId, achievementData) {
    try {
      const achievementRef = doc(db, "achievements", achievementId);

      const updatedData = {
        ...achievementData,
        updatedAt: serverTimestamp(),
      };

      await updateDoc(achievementRef, updatedData);
      return {
        id: achievementId,
        ...updatedData,
      };
    } catch (error) {
      console.error(`Error updating achievement ${achievementId}:`, error);
      throw error;
    }
  },

  /**
   * Delete an achievement
   */
  async deleteAchievement(achievementId) {
    try {
      const achievementRef = doc(db, "achievements", achievementId);
      await deleteDoc(achievementRef);
      return true;
    } catch (error) {
      console.error(`Error deleting achievement ${achievementId}:`, error);
      throw error;
    }
  },

  /**
   * Award an achievement to a user
   */
  async awardAchievementToUser(userId, achievementId) {
    try {
      // Check if user already has this achievement
      const userAchievementsRef = collection(db, "userAchievements");
      const q = query(
        userAchievementsRef,
        where("userId", "==", userId),
        where("achievementId", "==", achievementId)
      );

      const existingAwards = await getDocs(q);

      if (!existingAwards.empty) {
        console.log(`User ${userId} already has achievement ${achievementId}`);
        return false; // User already has this achievement
      }

      // Get the achievement details
      const achievement = await this.getAchievementById(achievementId);

      // Create a new user achievement record
      const userAchievementData = {
        userId,
        achievementId,
        achievementName: achievement.name,
        achievementImageUrl: achievement.imageUrl,
        achievementDescription: achievement.description,
        points: achievement.points || 0,
        awardedAt: serverTimestamp(),
      };

      await addDoc(userAchievementsRef, userAchievementData);

      // Update user's total achievement points
      await this.updateUserAchievementPoints(userId, achievement.points || 0);

      return true;
    } catch (error) {
      console.error(
        `Error awarding achievement ${achievementId} to user ${userId}:`,
        error
      );
      throw error;
    }
  },

  /**
   * Update a user's total achievement points
   */
  async updateUserAchievementPoints(userId, pointsToAdd) {
    try {
      const userRef = doc(db, "users", userId);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        throw new Error("User not found");
      }

      const userData = userSnap.data();
      const currentPoints = userData.achievementPoints || 0;

      await updateDoc(userRef, {
        achievementPoints: currentPoints + pointsToAdd,
      });

      return currentPoints + pointsToAdd;
    } catch (error) {
      console.error(
        `Error updating achievement points for user ${userId}:`,
        error
      );
      throw error;
    }
  },

  /**
   * Get all achievements for a specific user
   */
  async getUserAchievements(userId) {
    try {
      const userAchievementsRef = collection(db, "userAchievements");
      const q = query(userAchievementsRef, where("userId", "==", userId));
      const snapshot = await getDocs(q);

      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
    } catch (error) {
      console.error(`Error fetching achievements for user ${userId}:`, error);
      throw error;
    }
  },

  /**
   * Check if a user has a specific achievement
   */
  async hasAchievement(userId, achievementId) {
    try {
      const userAchievementsRef = collection(db, "userAchievements");
      const q = query(
        userAchievementsRef,
        where("userId", "==", userId),
        where("achievementId", "==", achievementId)
      );

      const snapshot = await getDocs(q);
      return !snapshot.empty;
    } catch (error) {
      console.error(
        `Error checking if user ${userId} has achievement ${achievementId}:`,
        error
      );
      throw error;
    }
  },

  /**
   * Evaluate if a user meets the conditions for an achievement
   * This function takes:
   * - userId: The user to check
   * - achievementId: The achievement to evaluate
   * - contextData: Any relevant data needed for evaluation (e.g., products created, investments made)
   */
  async evaluateAchievementCondition(userId, achievementId, contextData = {}) {
    try {
      // Get the achievement
      const achievement = await this.getAchievementById(achievementId);

      // Check if it has a condition function
      if (!achievement.triggerCondition) {
        console.log(
          `Achievement ${achievementId} has no trigger condition defined`
        );
        return false;
      }

      // For safety, we'll use a try-catch within a Function constructor to evaluate the condition
      try {
        // Create a safe evaluation function from the stored string
        const conditionFn = new Function(
          "userId",
          "contextData",
          achievement.triggerCondition
        );

        // Execute the condition with the provided data
        const conditionMet = conditionFn(userId, contextData);

        return conditionMet;
      } catch (evalError) {
        console.error(
          `Error evaluating condition for achievement ${achievementId}:`,
          evalError
        );
        return false;
      }
    } catch (error) {
      console.error(`Error in achievement condition evaluation:`, error);
      return false;
    }
  },

  /**
   * Check all achievements for a user and award any that match their conditions
   * Use this when checking achievements in bulk
   */
  async checkAndAwardAchievements(userId, contextData = {}) {
    try {
      // Get all achievements
      const achievements = await this.getAllAchievements();

      // Get user's current achievements
      const userAchievements = await this.getUserAchievements(userId);
      const userAchievementIds = userAchievements.map((ua) => ua.achievementId);

      // Filter out achievements the user already has
      const candidateAchievements = achievements.filter(
        (achievement) => !userAchievementIds.includes(achievement.id)
      );

      // Track newly awarded achievements
      const newlyAwarded = [];

      // Evaluate each achievement
      for (const achievement of candidateAchievements) {
        const conditionMet = await this.evaluateAchievementCondition(
          userId,
          achievement.id,
          contextData
        );

        if (conditionMet) {
          // Award the achievement
          await this.awardAchievementToUser(userId, achievement.id);
          newlyAwarded.push(achievement);
        }
      }

      return newlyAwarded;
    } catch (error) {
      console.error(
        `Error checking and awarding achievements for user ${userId}:`,
        error
      );
      throw error;
    }
  },

  /**
   * Award an achievement to a user directly in the users collection
   * This is a simpler implementation that just adds the achievement ID to the user's achievements array
   */
  async directlyAwardAchievement(userId, achievementId) {
    try {
      // Check if user exists
      const userRef = doc(db, "users", userId);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        console.error(`User ${userId} not found for awarding achievement`);
        return { success: false, error: "User not found" };
      }

      // Get user data and check if they already have this achievement
      const userData = userSnap.data();
      const userAchievements = userData.achievements || [];

      if (userAchievements.includes(achievementId)) {
        console.log(`User ${userId} already has achievement ${achievementId}`);
        return { success: true, alreadyAwarded: true };
      }

      // Award the achievement by adding to the user's achievements array
      await updateDoc(userRef, {
        achievements: arrayUnion(achievementId),
        updatedAt: serverTimestamp(),
      });

      // Get achievement details for points
      const achievement = await this.getAchievementById(achievementId);

      // Update achievement stats
      const achievementRef = doc(db, "achievements", achievementId);
      await updateDoc(achievementRef, {
        awardCount: (achievement.awardCount || 0) + 1,
        updatedAt: serverTimestamp(),
      });

      // Also update user achievement points if applicable
      if (achievement.points) {
        const currentPoints = userData.achievementPoints || 0;
        await updateDoc(userRef, {
          achievementPoints: currentPoints + achievement.points,
        });
      }

      console.log(`Achievement ${achievementId} awarded to user ${userId}`);
      return { success: true, achievement };
    } catch (error) {
      console.error(
        `Error directly awarding achievement ${achievementId} to user ${userId}:`,
        error
      );
      return { success: false, error: error.message };
    }
  },

  /**
   * Check achievements from the default predefined list for automatic awarding
   */
  async checkProductAchievements(userId) {
    try {
      // Get user's product count
      const productsRef = collection(db, "products");
      const q = query(productsRef, where("creatorId", "==", userId));
      const snapshot = await getDocs(q);
      const productCount = snapshot.docs.length;

      // Get achievements that need to be checked
      const achievementsRef = collection(db, "achievements");
      const achievementsSnapshot = await getDocs(achievementsRef);

      // Get IDs of product-related achievements
      const productAchievementIds = achievementsSnapshot.docs
        .filter((doc) => {
          const data = doc.data();
          return (
            data.category === "product" ||
            (data.triggerConfig && data.triggerConfig.type === "product_upload")
          );
        })
        .map((doc) => doc.id);

      // Get user's current achievements
      const userRef = doc(db, "users", userId);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        return { earnedIds: [] };
      }

      const userData = userSnap.data();
      const userAchievements = userData.achievements || [];

      // Filter to achievements user doesn't have yet
      const candidateAchievements = productAchievementIds.filter(
        (id) => !userAchievements.includes(id)
      );

      // Check each achievement condition and award if met
      const earnedIds = [];

      for (const achievementId of candidateAchievements) {
        // Get specific achievement details
        const achievementDoc = achievementsSnapshot.docs.find(
          (doc) => doc.id === achievementId
        );
        if (!achievementDoc) continue;

        const achievement = { id: achievementId, ...achievementDoc.data() };

        // Check if condition is met
        let conditionMet = false;

        // Handle predefined achievements from achievementsData.js
        if (achievement.id === "first_product" && productCount >= 1) {
          conditionMet = true;
        } else if (
          achievement.id === "product_collector_5" &&
          productCount >= 5
        ) {
          conditionMet = true;
        } else if (
          achievement.id === "product_collector_10" &&
          productCount >= 10
        ) {
          conditionMet = true;
        } else if (
          achievement.id === "product_collector_25" &&
          productCount >= 25
        ) {
          conditionMet = true;
        }

        // Handle custom trigger configurations
        else if (
          achievement.triggerConfig &&
          achievement.triggerConfig.type === "product_upload"
        ) {
          if (achievement.triggerConfig.condition === "count") {
            const requiredCount = parseInt(achievement.triggerConfig.value);
            if (!isNaN(requiredCount) && productCount >= requiredCount) {
              conditionMet = true;
            }
          }
        }

        // Award achievement if condition is met
        if (conditionMet) {
          const result = await this.directlyAwardAchievement(
            userId,
            achievementId
          );
          if (result.success && !result.alreadyAwarded) {
            earnedIds.push(achievementId);
          }
        }
      }

      return { earnedIds };
    } catch (error) {
      console.error("Error checking product achievements:", error);
      return { earnedIds: [] };
    }
  },

  /**
   * Check investment-related achievements
   */
  async checkInvestmentAchievements(userId) {
    try {
      // Get user's investments
      const investmentsRef = collection(db, "investments");
      const q = query(investmentsRef, where("investorId", "==", userId));
      const snapshot = await getDocs(q);
      const investmentCount = snapshot.docs.length;

      // Calculate total amount invested
      let totalInvested = 0;
      snapshot.docs.forEach((doc) => {
        const investment = doc.data();
        totalInvested += investment.amount || 0;
      });

      // Get achievements that need to be checked
      const achievementsRef = collection(db, "achievements");
      const achievementsSnapshot = await getDocs(achievementsRef);

      // Get IDs of investment-related achievements
      const investmentAchievementIds = achievementsSnapshot.docs
        .filter((doc) => {
          const data = doc.data();
          return (
            data.category === "investment" ||
            (data.triggerConfig && data.triggerConfig.type === "investment")
          );
        })
        .map((doc) => doc.id);

      // Get user's current achievements
      const userRef = doc(db, "users", userId);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        return { earnedIds: [] };
      }

      const userData = userSnap.data();
      const userAchievements = userData.achievements || [];

      // Filter to achievements user doesn't have yet
      const candidateAchievements = investmentAchievementIds.filter(
        (id) => !userAchievements.includes(id)
      );

      // Check each achievement condition and award if met
      const earnedIds = [];

      for (const achievementId of candidateAchievements) {
        // Get specific achievement details
        const achievementDoc = achievementsSnapshot.docs.find(
          (doc) => doc.id === achievementId
        );
        if (!achievementDoc) continue;

        const achievement = { id: achievementId, ...achievementDoc.data() };

        // Check if condition is met
        let conditionMet = false;

        // Handle predefined achievements from achievementsData.js
        if (achievement.id === "first_investment" && investmentCount >= 1) {
          conditionMet = true;
        } else if (achievement.id === "investor_3" && investmentCount >= 3) {
          conditionMet = true;
        } else if (achievement.id === "investor_10" && investmentCount >= 10) {
          conditionMet = true;
        }

        // Award achievement if condition is met
        if (conditionMet) {
          const result = await this.directlyAwardAchievement(
            userId,
            achievementId
          );
          if (result.success && !result.alreadyAwarded) {
            earnedIds.push(achievementId);
          }
        }
      }

      return { earnedIds };
    } catch (error) {
      console.error("Error checking investment achievements:", error);
      return { earnedIds: [] };
    }
  },

  /**
   * Check achievements related to account age and engagement
   */
  async checkAccountAgeAchievements(userId) {
    try {
      // Get user data
      const userRef = doc(db, "users", userId);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        return { earnedIds: [] };
      }

      const userData = userSnap.data();
      const userAchievements = userData.achievements || [];
      const createdAt = userData.createdAt?.toDate() || new Date();

      // Calculate account age in days
      const now = new Date();
      const ageInMs = now.getTime() - createdAt.getTime();
      const ageInDays = Math.floor(ageInMs / (1000 * 60 * 60 * 24));

      // Get achievements to check
      const achievementsRef = collection(db, "achievements");
      const achievementsSnapshot = await getDocs(achievementsRef);

      // Get loyalty achievements
      const loyaltyAchievementIds = achievementsSnapshot.docs
        .filter((doc) => {
          const data = doc.data();
          return (
            data.category === "loyalty" ||
            (data.triggerConfig &&
              data.triggerConfig.type === "time_registered")
          );
        })
        .map((doc) => doc.id);

      // Filter to achievements user doesn't have yet
      const candidateAchievements = loyaltyAchievementIds.filter(
        (id) => !userAchievements.includes(id)
      );

      // Check each achievement condition and award if met
      const earnedIds = [];

      for (const achievementId of candidateAchievements) {
        const achievementDoc = achievementsSnapshot.docs.find(
          (doc) => doc.id === achievementId
        );
        if (!achievementDoc) continue;

        const achievement = { id: achievementId, ...achievementDoc.data() };

        // Check if condition is met
        let conditionMet = false;

        // "Veteran User" achievement - 3 months (90 days)
        if (achievement.id === "veteran_user" && ageInDays >= 90) {
          conditionMet = true;
        }

        // Award achievement if condition is met
        if (conditionMet) {
          const result = await this.directlyAwardAchievement(
            userId,
            achievementId
          );
          if (result.success && !result.alreadyAwarded) {
            earnedIds.push(achievementId);
          }
        }
      }

      return { earnedIds };
    } catch (error) {
      console.error("Error checking account age achievements:", error);
      return { earnedIds: [] };
    }
  },

  /**
   * Placeholder implementation for quote achievements
   */
  async checkQuoteAchievements(userId) {
    // This would contain similar logic to the other achievement checkers
    // but for manufacturing quotes
    return { earnedIds: [] };
  },

  /**
   * Placeholder implementation for review achievements
   */
  async checkReviewAchievements(userId) {
    // This would contain similar logic to the other achievement checkers
    // but for product reviews
    return { earnedIds: [] };
  },
};

export default achievementService;
