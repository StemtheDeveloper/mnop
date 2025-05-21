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
  arrayRemove,
  serverTimestamp,
} from "firebase/firestore";

/**
 * Service for managing user blocking functionality
 */
class BlockService {
  /**
   * Block a user
   * @param {string} currentUserId - The ID of the current user doing the blocking
   * @param {string} blockedUserId - The ID of the user to block
   * @param {boolean} blockContent - Whether to also block content from this user
   * @returns {Promise<Object>} - Result with success status
   */
  async blockUser(currentUserId, blockedUserId, blockContent = true) {
    try {
      // Validate parameters
      if (!currentUserId) throw new Error("Current user ID is required");
      if (!blockedUserId) throw new Error("Blocked user ID is required");
      if (currentUserId === blockedUserId) {
        return {
          success: false,
          error: "You cannot block yourself",
        };
      }

      // Get the current user's document
      const userRef = doc(db, "users", currentUserId);
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) {
        return {
          success: false,
          error: "User not found",
        };
      }

      // Initialize or get the user's blockedUsers array
      const userData = userDoc.data();
      let blockedUsers = userData.blockedUsers || [];

      // If the user is already blocked, update the settings only
      const existingBlock = blockedUsers.find(
        (block) => block.userId === blockedUserId
      );

      if (existingBlock) {
        // Update the existing block settings
        blockedUsers = blockedUsers.map((block) =>
          block.userId === blockedUserId
            ? { ...block, blockContent, updatedAt: new Date() }
            : block
        );
      } else {
        // Add new blocked user
        blockedUsers.push({
          userId: blockedUserId,
          blockContent,
          blockedAt: new Date(),
          updatedAt: new Date(),
        });
      }

      // Update the user document
      await updateDoc(userRef, {
        blockedUsers,
        updatedAt: serverTimestamp(),
      });

      return {
        success: true,
        message: `User has been blocked successfully`,
      };
    } catch (error) {
      console.error("Error blocking user:", error);
      return {
        success: false,
        error: error.message || "Failed to block user",
      };
    }
  }

  /**
   * Unblock a user
   * @param {string} currentUserId - The ID of the current user
   * @param {string} blockedUserId - The ID of the blocked user to unblock
   * @returns {Promise<Object>} - Result with success status
   */
  async unblockUser(currentUserId, blockedUserId) {
    try {
      // Validate parameters
      if (!currentUserId) throw new Error("Current user ID is required");
      if (!blockedUserId) throw new Error("Blocked user ID is required");

      // Get the current user's document
      const userRef = doc(db, "users", currentUserId);
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) {
        return {
          success: false,
          error: "User not found",
        };
      }

      // Get the user's blockedUsers array
      const userData = userDoc.data();
      let blockedUsers = userData.blockedUsers || [];

      // Remove the user from the blocked list
      blockedUsers = blockedUsers.filter(
        (block) => block.userId !== blockedUserId
      );

      // Update the user document
      await updateDoc(userRef, {
        blockedUsers,
        updatedAt: serverTimestamp(),
      });

      return {
        success: true,
        message: `User has been unblocked successfully`,
      };
    } catch (error) {
      console.error("Error unblocking user:", error);
      return {
        success: false,
        error: error.message || "Failed to unblock user",
      };
    }
  }

  /**
   * Get list of users blocked by a specific user
   * @param {string} userId - User ID to get blocked users for
   * @returns {Promise<Array>} - Array of blocked user objects with user details
   */
  async getBlockedUsers(userId) {
    try {
      if (!userId) throw new Error("User ID is required");

      // Get the user's document
      const userRef = doc(db, "users", userId);
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) {
        throw new Error("User not found");
      }

      // Get the blocked users array
      const userData = userDoc.data();
      const blockedUsers = userData.blockedUsers || [];

      // If there are no blocked users, return an empty array
      if (blockedUsers.length === 0) {
        return [];
      }

      // Get details for all blocked users
      const blockedUserDetails = await Promise.all(
        blockedUsers.map(async (block) => {
          try {
            const blockedUserRef = doc(db, "users", block.userId);
            const blockedUserDoc = await getDoc(blockedUserRef);

            if (!blockedUserDoc.exists()) {
              return {
                ...block,
                displayName: "Deleted User",
                photoURL: null,
              };
            }

            const blockedUserData = blockedUserDoc.data();
            return {
              ...block,
              displayName: blockedUserData.displayName || "Unknown User",
              photoURL: blockedUserData.photoURL || null,
              email: blockedUserData.email || null,
            };
          } catch (error) {
            console.error(
              `Error getting details for blocked user ${block.userId}:`,
              error
            );
            return {
              ...block,
              displayName: "Error Loading User",
              photoURL: null,
            };
          }
        })
      );

      return blockedUserDetails;
    } catch (error) {
      console.error("Error getting blocked users:", error);
      throw error;
    }
  }

  /**
   * Check if a specific user is blocked by another user
   * @param {string} userId - User to check
   * @param {string} blockedUserId - Potentially blocked user
   * @returns {Promise<Object>} - Object containing isBlocked status and blockContent setting
   */
  async isUserBlocked(userId, blockedUserId) {
    try {
      if (!userId || !blockedUserId) {
        return { isBlocked: false, blockContent: false };
      }

      // Get the user's document
      const userRef = doc(db, "users", userId);
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) {
        return { isBlocked: false, blockContent: false };
      }

      // Check if the user is in the blockedUsers array
      const userData = userDoc.data();
      const blockedUsers = userData.blockedUsers || [];
      const blockedUser = blockedUsers.find(
        (block) => block.userId === blockedUserId
      );

      if (blockedUser) {
        return {
          isBlocked: true,
          blockContent: blockedUser.blockContent || false,
        };
      }

      return { isBlocked: false, blockContent: false };
    } catch (error) {
      console.error("Error checking if user is blocked:", error);
      return { isBlocked: false, blockContent: false };
    }
  }
}

export const blockService = new BlockService();
export default blockService;
