// User search service to find users with specific roles
import {
  collection,
  query,
  where,
  getDocs,
  or,
  orderBy,
  limit
} from "firebase/firestore";
import { db } from "../config/firebase";

class UserSearchService {
  /**
   * Search for users with specific roles (designer, manufacturer, investor)
   * @param {string} searchTerm - Search term for name or email
   * @param {number} limitCount - Maximum number of results to return
   * @returns {Promise<Array>} - Array of matching user objects
   */
  async searchUsersByRole(searchTerm, limitCount = 20) {
    try {
      const usersRef = collection(db, "users");
      const searchTermLower = searchTerm.toLowerCase();
      
      // Get users who have roles (we'll filter by searchTerm client-side)
      const querySnapshot = await getDocs(
        query(
          usersRef,
          or(
            where("roles", "array-contains", "designer"),
            where("roles", "array-contains", "manufacturer"),
            where("roles", "array-contains", "investor")
          ),
          orderBy("displayName"),
          limit(limitCount * 3) // Fetch more to filter
        )
      );

      // Filter client-side for name/email match and remove users who are only customers
      const users = [];

      querySnapshot.forEach((doc) => {
        const userData = doc.data();
        const displayName = (userData.displayName || "").toLowerCase();
        const email = (userData.email || "").toLowerCase();
        
        if (displayName.includes(searchTermLower) || email.includes(searchTermLower)) {
          // Make sure user has one of the business roles 
          const roles = userData.roles || [];
          const hasBusinessRole = roles.some(role => 
            ["designer", "manufacturer", "investor"].includes(role)
          );
          
          if (hasBusinessRole) {
            users.push({
              id: doc.id,
              ...userData
            });
          }
        }
      });

      // Limit results to the requested count
      return users.slice(0, limitCount);
    } catch (error) {
      console.error("Error searching users:", error);
      throw error;
    }
  }
}

const userSearchService = new UserSearchService();
export default userSearchService;