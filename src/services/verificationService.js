import {
  doc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { db } from "../config/firebase";

class VerificationService {
  /**
   * Verify a user as a manufacturer or designer
   * @param {string} userId - User ID to verify
   * @param {string} role - Role to verify (manufacturer or designer)
   * @param {boolean} verified - Verification status
   * @returns {Promise<Object>} Result object
   */
  async verifyUser(userId, role, verified = true) {
    try {
      if (!userId || !["manufacturer", "designer"].includes(role)) {
        return {
          success: false,
          error: "Invalid user ID or role",
        };
      }

      const userRef = doc(db, "users", userId);
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) {
        return {
          success: false,
          error: "User not found",
        };
      }

      // Update verification status based on role
      const verificationField = `${role}Verified`;
      await updateDoc(userRef, {
        [verificationField]: verified,
        updatedAt: new Date(),
      });

      return {
        success: true,
        message: `User successfully ${
          verified ? "verified" : "unverified"
        } as ${role}`,
      };
    } catch (error) {
      console.error("Error verifying user:", error);
      return {
        success: false,
        error: error.message || "Failed to verify user",
      };
    }
  }

  /**
   * Get all users with a specific role
   * @param {string} role - Role to filter by (manufacturer or designer)
   * @returns {Promise<Array>} Array of users
   */
  async getUsersByRole(role) {
    try {
      if (!["manufacturer", "designer"].includes(role)) {
        throw new Error("Invalid role");
      }

      const usersRef = collection(db, "users");
      const q = query(usersRef, where("roles", "array-contains", role));
      const snapshot = await getDocs(q);

      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
    } catch (error) {
      console.error(`Error getting ${role}s:`, error);
      throw error;
    }
  }

  /**
   * Get all verified manufacturers
   * @returns {Promise<Array>} Array of verified manufacturers
   */
  async getVerifiedManufacturers() {
    try {
      const usersRef = collection(db, "users");
      const q = query(
        usersRef,
        where("roles", "array-contains", "manufacturer"),
        where("manufacturerVerified", "==", true)
      );
      const snapshot = await getDocs(q);

      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
    } catch (error) {
      console.error("Error getting verified manufacturers:", error);
      return []; // Return empty array on error
    }
  }

  /**
   * Get all manufacturers (both verified and unverified)
   * @returns {Promise<Array>} Array of all manufacturers with verification status
   */
  async getAllManufacturers() {
    try {
      const usersRef = collection(db, "users");
      const q = query(
        usersRef,
        where("roles", "array-contains", "manufacturer")
      );
      const snapshot = await getDocs(q);

      return snapshot.docs.map((doc) => ({
        id: doc.id,
        verified: doc.data().manufacturerVerified === true,
        ...doc.data(),
      }));
    } catch (error) {
      console.error("Error getting manufacturers:", error);
      return []; // Return empty array on error
    }
  }
}

const verificationService = new VerificationService();
export default verificationService;
