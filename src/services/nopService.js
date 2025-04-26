import { db } from "../config/firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  setDoc,
  updateDoc,
  arrayUnion,
  serverTimestamp,
  Timestamp,
  orderBy,
  limit,
} from "firebase/firestore";

// Get the daily Nop
export const getDailyNop = async () => {
  try {
    // Get the current date (without time) as a string to use as the daily seed
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dateString = today.toISOString().split("T")[0];

    // First, check if there's a designated daily Nop in a settings document
    const dailyNopRef = doc(db, "settings", "dailyNop");
    const dailyNopDoc = await getDoc(dailyNopRef);

    if (dailyNopDoc.exists() && dailyNopDoc.data().date === dateString) {
      // If the daily Nop is already set for today, return it
      const nopId = dailyNopDoc.data().nopId;
      const nopDoc = await getDoc(doc(db, "nops", nopId));

      if (nopDoc.exists()) {
        return {
          id: nopDoc.id,
          ...nopDoc.data(),
        };
      }
    }

    // If no daily Nop set for today, get all Nops and select one randomly
    const nopsRef = collection(db, "nops");
    const nopsSnapshot = await getDocs(nopsRef);

    if (nopsSnapshot.empty) {
      throw new Error("No Nops available");
    }

    const nops = nopsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Use the date string as a seed for randomization
    const seed = dateString
      .split("")
      .reduce((sum, char) => sum + char.charCodeAt(0), 0);
    const pseudoRandom = Math.sin(seed) * 10000;
    const randomIndex = Math.floor(Math.abs(pseudoRandom) % nops.length);

    const selectedNop = nops[randomIndex];

    // Update the dailyNop document for today
    await setDoc(dailyNopRef, {
      nopId: selectedNop.id,
      date: dateString,
      updatedAt: serverTimestamp(),
    });

    return selectedNop;
  } catch (error) {
    console.error("Error getting daily Nop:", error);
    throw error;
  }
};

// Collect a Nop for a user
export const collectNop = async (userId, nopId) => {
  try {
    // Check if the user has already collected this Nop today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dateString = today.toISOString().split("T")[0];

    // Get user's collection data
    const userCollectionRef = doc(db, "users", userId, "collections", "nops");
    const userCollectionDoc = await getDoc(userCollectionRef);

    // Check if the user already collected this Nop today
    if (userCollectionDoc.exists()) {
      const collectionData = userCollectionDoc.data();
      const todayCollection = collectionData.dailyCollections?.find(
        (collection) => collection.date === dateString
      );

      if (todayCollection && todayCollection.nopId === nopId) {
        return {
          success: false,
          message: "You already collected this Nop today",
        };
      }
    }

    // Get the Nop details
    const nopRef = doc(db, "nops", nopId);
    const nopDoc = await getDoc(nopRef);

    if (!nopDoc.exists()) {
      return {
        success: false,
        message: "Nop not found",
      };
    }

    // Create a timestamp that can be safely stored in arrays
    const now = new Date();
    const timestamp = Timestamp.fromDate(now);

    const nopData = {
      id: nopId,
      ...nopDoc.data(),
      collectedAt: timestamp, // Use Timestamp instead of serverTimestamp
    };

    // Update the user's collection
    if (!userCollectionDoc.exists()) {
      // Create a new collection document if it doesn't exist
      await setDoc(userCollectionRef, {
        nops: [nopData],
        dailyCollections: [
          {
            date: dateString,
            nopId: nopId,
          },
        ],
        lastCollectedAt: serverTimestamp(), // This is fine outside arrays
      });
    } else {
      // Get existing collections to manually update them
      const existingData = userCollectionDoc.data();
      const existingNops = existingData.nops || [];
      const existingDailyCollections = existingData.dailyCollections || [];

      // Update with spread operators instead of arrayUnion
      await updateDoc(userCollectionRef, {
        nops: [...existingNops, nopData],
        dailyCollections: [
          ...existingDailyCollections,
          {
            date: dateString,
            nopId: nopId,
          },
        ],
        lastCollectedAt: serverTimestamp(),
      });
    }

    // Update the collection count on the user's main document
    const userRef = doc(db, "users", userId);
    const userDoc = await getDoc(userRef);

    if (userDoc.exists()) {
      const nopCount = (userDoc.data().nopCount || 0) + 1;
      await updateDoc(userRef, { nopCount });
    }

    return {
      success: true,
      message: "Nop collected successfully",
      nop: nopData,
    };
  } catch (error) {
    console.error("Error collecting Nop:", error);
    return {
      success: false,
      message: "Error collecting Nop: " + error.message,
    };
  }
};

// Check if a user has collected today's Nop
export const hasCollectedToday = async (userId) => {
  try {
    // Get today's date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dateString = today.toISOString().split("T")[0];

    // Get the daily Nop ID
    const dailyNopRef = doc(db, "settings", "dailyNop");
    const dailyNopDoc = await getDoc(dailyNopRef);

    if (!dailyNopDoc.exists() || dailyNopDoc.data().date !== dateString) {
      return false;
    }

    const dailyNopId = dailyNopDoc.data().nopId;

    // Check if the user has collected this Nop today
    const userCollectionRef = doc(db, "users", userId, "collections", "nops");
    const userCollectionDoc = await getDoc(userCollectionRef);

    if (!userCollectionDoc.exists()) {
      return false;
    }

    const collectionData = userCollectionDoc.data();
    return (
      collectionData.dailyCollections?.some(
        (collection) =>
          collection.date === dateString && collection.nopId === dailyNopId
      ) || false
    );
  } catch (error) {
    console.error("Error checking if Nop collected today:", error);
    return false;
  }
};

// Get a user's Nop collection
export const getUserNopCollection = async (userId) => {
  try {
    const userCollectionRef = doc(db, "users", userId, "collections", "nops");
    const userCollectionDoc = await getDoc(userCollectionRef);

    if (!userCollectionDoc.exists()) {
      return [];
    }

    const collectionData = userCollectionDoc.data();
    return collectionData.nops || [];
  } catch (error) {
    console.error("Error getting user Nop collection:", error);
    throw error;
  }
};

// Export all functions as a single default object as well
export default {
  getDailyNop,
  collectNop,
  hasCollectedToday,
  getUserNopCollection,
};
