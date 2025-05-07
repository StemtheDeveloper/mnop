import { db } from '../config/firebase';
import { doc, getDoc, collection, query, where, getDocs, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';

/**
 * Service for handling verification requests and verification status
 */
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
   * Submit a verification request
   * @param {string} userId - User ID requesting verification
   * @param {string} role - Role requesting verification for (manufacturer or designer)
   * @param {Object} data - Verification data including company info, documents, etc.
   * @returns {Promise<Object>} Result object
   */
  async submitVerificationRequest(userId, role, data) {
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

      // Check if user already has a pending request
      const requestsRef = collection(db, "verificationRequests");
      const q = query(
        requestsRef,
        where("userId", "==", userId),
        where("role", "==", role),
        where("status", "==", "pending")
      );
      
      const existingRequests = await getDocs(q);

      if (!existingRequests.empty) {
        return {
          success: false,
          error: "You already have a pending verification request for this role",
        };
      }

      // Create verification request
      const verificationRequest = {
        userId,
        role,
        status: "pending",
        data: {
          ...data,
          userEmail: userDoc.data().email || "",
          displayName: userDoc.data().displayName || "",
          photoURL: userDoc.data().photoURL || "",
        },
        submittedAt: serverTimestamp(),
      };

      // Add to verificationRequests collection
      await addDoc(collection(db, "verificationRequests"), verificationRequest);

      // Update user document to mark verification as requested
      await updateDoc(userRef, {
        [`${role}VerificationRequested`]: true,
        updatedAt: new Date()
      });

      return {
        success: true,
        message: "Verification request submitted successfully",
      };
    } catch (error) {
      console.error("Error submitting verification request:", error);
      return {
        success: false,
        error: error.message || "Failed to submit verification request",
      };
    }
  }

  /**
   * Get all verification requests
   * @param {string} status - Filter by status (pending, approved, rejected)
   * @returns {Promise<Array>} Array of verification requests
   */
  async getVerificationRequests(status = null) {
    try {
      const requestsRef = collection(db, "verificationRequests");
      let q;
      
      if (status) {
        q = query(requestsRef, where("status", "==", status));
      } else {
        q = query(requestsRef);
      }
      
      const snapshot = await getDocs(q);
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error("Error getting verification requests:", error);
      return [];
    }
  }

  /**
   * Process a verification request (approve or reject)
   * @param {string} requestId - Request ID
   * @param {string} decision - Decision (approve or reject)
   * @param {string} adminId - Admin user ID who processed the request
   * @param {string} notes - Optional notes about the decision
   * @returns {Promise<Object>} Result object
   */
  async processVerificationRequest(requestId, decision, adminId, notes = "") {
    try {
      const requestRef = doc(db, "verificationRequests", requestId);
      const requestDoc = await getDoc(requestRef);

      if (!requestDoc.exists()) {
        return {
          success: false,
          error: "Verification request not found",
        };
      }

      const requestData = requestDoc.data();
      const { userId, role } = requestData;

      // Update request status
      await updateDoc(requestRef, {
        status: decision === "approve" ? "approved" : "rejected",
        processedBy: adminId,
        processedAt: new Date(),
        notes,
      });

      // If approved, update user's verification status
      if (decision === "approve") {
        const userRef = doc(db, "users", userId);
        await updateDoc(userRef, {
          [`${role}Verified`]: true,
          [`${role}VerificationRequested`]: false,
          updatedAt: new Date(),
        });
      } else {
        // If rejected, update request status but don't verify
        const userRef = doc(db, "users", userId);
        await updateDoc(userRef, {
          [`${role}VerificationRequested`]: false,
          updatedAt: new Date(),
        });
      }

      return {
        success: true,
        message: `Verification request ${
          decision === "approve" ? "approved" : "rejected"
        } successfully`,
      };
    } catch (error) {
      console.error("Error processing verification request:", error);
      return {
        success: false,
        error: error.message || "Failed to process verification request",
      };
    }
  }
}

export default new VerificationService();
