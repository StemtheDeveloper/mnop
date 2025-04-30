import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../config/firebase";

class PolicyService {
  /**
   * Current versions of all policies
   * Update these constants when publishing new versions of policies
   */
  static CURRENT_VERSIONS = {
    terms: "1.0",
    privacy: "1.0",
    content: "1.0",
  };

  /**
   * Check if a user has accepted all current policy versions
   *
   * @param {string} userId - The user's ID
   * @returns {Promise<Object>} Object containing acceptance status for each policy
   */
  static async checkPolicyAcceptance(userId) {
    try {
      const userRef = doc(db, "users", userId);
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) {
        throw new Error("User document not found");
      }

      const userData = userDoc.data();

      return {
        terms:
          userData.termsAccepted &&
          userData.termsVersion === this.CURRENT_VERSIONS.terms,
        privacy:
          userData.privacyPolicyAccepted &&
          userData.privacyPolicyVersion === this.CURRENT_VERSIONS.privacy,
        content:
          userData.contentPolicyAccepted &&
          userData.contentPolicyVersion === this.CURRENT_VERSIONS.content,
        hasAcceptedAll:
          userData.termsAccepted &&
          userData.termsVersion === this.CURRENT_VERSIONS.terms &&
          userData.privacyPolicyAccepted &&
          userData.privacyPolicyVersion === this.CURRENT_VERSIONS.privacy &&
          userData.contentPolicyAccepted &&
          userData.contentPolicyVersion === this.CURRENT_VERSIONS.content,
      };
    } catch (error) {
      console.error("Error checking policy acceptance:", error);
      throw error;
    }
  }

  /**
   * Accept a specific policy for a user
   *
   * @param {string} userId - The user's ID
   * @param {string} policyType - The policy type ('terms', 'privacy', or 'content')
   * @returns {Promise<void>}
   */
  static async acceptPolicy(userId, policyType) {
    try {
      if (!["terms", "privacy", "content"].includes(policyType)) {
        throw new Error("Invalid policy type");
      }

      const userRef = doc(db, "users", userId);

      // Create the update object dynamically based on policy type
      const updateData = {};

      if (policyType === "terms") {
        updateData.termsAccepted = true;
        updateData.termsVersion = this.CURRENT_VERSIONS.terms;
        updateData.termsAcceptedDate = new Date();
      } else if (policyType === "privacy") {
        updateData.privacyPolicyAccepted = true;
        updateData.privacyPolicyVersion = this.CURRENT_VERSIONS.privacy;
        updateData.privacyPolicyAcceptedDate = new Date();
      } else if (policyType === "content") {
        updateData.contentPolicyAccepted = true;
        updateData.contentPolicyVersion = this.CURRENT_VERSIONS.content;
        updateData.contentPolicyAcceptedDate = new Date();
      }

      await updateDoc(userRef, updateData);
    } catch (error) {
      console.error(`Error accepting ${policyType} policy:`, error);
      throw error;
    }
  }

  /**
   * Accept all current policies for a user
   *
   * @param {string} userId - The user's ID
   * @returns {Promise<void>}
   */
  static async acceptAllPolicies(userId) {
    try {
      const userRef = doc(db, "users", userId);
      const now = new Date();

      const updateData = {
        termsAccepted: true,
        termsVersion: this.CURRENT_VERSIONS.terms,
        termsAcceptedDate: now,
        privacyPolicyAccepted: true,
        privacyPolicyVersion: this.CURRENT_VERSIONS.privacy,
        privacyPolicyAcceptedDate: now,
        contentPolicyAccepted: true,
        contentPolicyVersion: this.CURRENT_VERSIONS.content,
        contentPolicyAcceptedDate: now,
      };

      await updateDoc(userRef, updateData);
    } catch (error) {
      console.error("Error accepting all policies:", error);
      throw error;
    }
  }

  /**
   * Get a list of policies that need acceptance
   *
   * @param {string} userId - The user's ID
   * @returns {Promise<Array>} Array of policy objects that need acceptance
   */
  static async getPendingPolicies(userId) {
    try {
      const acceptance = await this.checkPolicyAcceptance(userId);
      const pendingPolicies = [];

      if (!acceptance.terms) {
        pendingPolicies.push({
          type: "terms",
          name: "Terms and Conditions",
          path: "/terms-and-conditions",
          version: this.CURRENT_VERSIONS.terms,
        });
      }

      if (!acceptance.privacy) {
        pendingPolicies.push({
          type: "privacy",
          name: "Privacy Policy",
          path: "/privacy-policy",
          version: this.CURRENT_VERSIONS.privacy,
        });
      }

      if (!acceptance.content) {
        pendingPolicies.push({
          type: "content",
          name: "Content Policy",
          path: "/content-policy",
          version: this.CURRENT_VERSIONS.content,
        });
      }

      return pendingPolicies;
    } catch (error) {
      console.error("Error getting pending policies:", error);
      throw error;
    }
  }
}

export default PolicyService;
