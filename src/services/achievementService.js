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
};

export default achievementService;
