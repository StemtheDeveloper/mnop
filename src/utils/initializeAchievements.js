import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../config/firebase";
import achievementsData from "../data/achievementsData";

/**
 * Initialize achievements in Firestore
 * Run this once to populate the achievements collection
 */
export const initializeAchievements = async () => {
  try {
    console.log("Initializing achievements...");

    // Check which achievements already exist
    const achievementsRef = collection(db, "achievements");
    const existingAchievements = await getDocs(achievementsRef);
    const existingIds = existingAchievements.docs.map((doc) => doc.data().id);

    // Filter to only add achievements that don't exist
    const newAchievements = achievementsData.filter(
      (achievement) => !existingIds.includes(achievement.id)
    );

    if (newAchievements.length === 0) {
      console.log("All achievements already exist in Firestore.");
      return { success: true, message: "No new achievements to add" };
    }

    // Add timestamps to achievements
    const now = serverTimestamp();
    const achievementsToAdd = newAchievements.map((achievement) => ({
      ...achievement,
      createdAt: now,
      updatedAt: now,
    }));

    // Add each achievement to Firestore
    const addedAchievements = [];

    for (const achievement of achievementsToAdd) {
      const docRef = await addDoc(achievementsRef, achievement);
      addedAchievements.push({
        id: docRef.id,
        ...achievement,
      });

      console.log(`Added achievement: ${achievement.name}`);
    }

    console.log(
      `Successfully added ${addedAchievements.length} new achievements.`
    );

    return {
      success: true,
      message: `Added ${addedAchievements.length} new achievements`,
      achievements: addedAchievements,
    };
  } catch (error) {
    console.error("Error initializing achievements:", error);
    return {
      success: false,
      message: "Error initializing achievements",
      error,
    };
  }
};
