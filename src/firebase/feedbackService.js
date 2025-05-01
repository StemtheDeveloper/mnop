import { collection, addDoc } from "firebase/firestore";
import { db } from "../config/firebase";

/**
 * Adds a feedback entry to Firestore
 * @param {Object} feedbackData - The feedback data to store
 * @param {string} feedbackData.userId - User ID or 'anonymous'
 * @param {string} feedbackData.userEmail - User email or 'anonymous'
 * @param {string} feedbackData.feedback - The feedback text
 * @param {number} feedbackData.rating - Numeric rating (1-5)
 * @param {string} feedbackData.page - The page URL path where feedback was given
 * @param {Date} feedbackData.timestamp - When the feedback was submitted
 * @returns {Promise<DocumentReference>} - A promise that resolves with the document reference
 */
export const addFeedback = async (feedbackData) => {
  try {
    const docRef = await addDoc(collection(db, "feedback"), feedbackData);
    return docRef;
  } catch (error) {
    console.error("Error adding feedback document: ", error);
    throw error;
  }
};
