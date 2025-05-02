import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { db } from "../config/firebase";

/**
 * Adds a new feedback entry to Firestore
 * @param {Object} feedbackData - Feedback data to store
 * @param {string} feedbackData.userId - User ID (or 'anonymous')
 * @param {string} feedbackData.userEmail - User email (or 'anonymous')
 * @param {string} feedbackData.feedback - Feedback text content
 * @param {number} feedbackData.rating - Rating between 1-5
 * @param {string} feedbackData.page - Page where feedback was submitted
 * @param {Date} feedbackData.timestamp - When feedback was submitted
 * @returns {Promise<string>} - ID of the created document
 */
export const addFeedback = async (feedbackData) => {
  try {
    const docRef = await addDoc(collection(db, "feedback"), feedbackData);
    return docRef.id;
  } catch (error) {
    console.error("Error adding feedback:", error);
    throw error;
  }
};

/**
 * Gets all feedback entries, ordered by timestamp
 * @returns {Promise<Array>} Array of feedback objects with their IDs
 */
export const getAllFeedback = async () => {
  try {
    const q = query(collection(db, "feedback"), orderBy("timestamp", "desc"));
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp?.toDate(),
    }));
  } catch (error) {
    console.error("Error getting feedback:", error);
    throw error;
  }
};

/**
 * Deletes a feedback entry
 * @param {string} id - Feedback document ID to delete
 * @returns {Promise<void>}
 */
export const deleteFeedback = async (id) => {
  try {
    await deleteDoc(doc(db, "feedback", id));
  } catch (error) {
    console.error("Error deleting feedback:", error);
    throw error;
  }
};
