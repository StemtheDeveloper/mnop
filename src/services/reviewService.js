import { db } from "../config/firebase";
import {
  collection,
  addDoc,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  updateDoc,
  serverTimestamp,
  increment,
  arrayUnion,
  arrayRemove,
  limit,
  startAfter,
  deleteDoc,
  Timestamp,
  documentId,
} from "firebase/firestore";
import { achievementService } from "./achievementService";

class ReviewService {
  /**
   * Get all reviews for a product with optional sorting and filtering
   * @param {string} productId - The product ID
   * @param {Object} options - Query options
   * @param {string} options.sortBy - Sort by field ('newest', 'highest', 'lowest', 'helpful')
   * @param {number} options.ratingFilter - Filter by rating (1-5)
   * @param {number} options.pageSize - Number of reviews per page
   * @param {Object} options.lastDoc - Last document for pagination
   * @param {boolean} options.withReplies - Include review replies
   * @returns {Promise<Object>} - Product reviews or error
   */
  async getProductReviews(productId, options = {}) {
    try {
      const {
        sortBy = "newest",
        ratingFilter = 0,
        pageSize = 10,
        lastDoc = null,
        withReplies = true,
      } = options;

      // Build the base query
      const reviewsRef = collection(db, "reviews");
      let reviewQuery = query(reviewsRef, where("productId", "==", productId));

      // Apply rating filter if specified
      if (ratingFilter > 0) {
        reviewQuery = query(reviewQuery, where("rating", "==", ratingFilter));
      }

      // Apply sorting
      switch (sortBy) {
        case "highest":
          reviewQuery = query(
            reviewQuery,
            orderBy("rating", "desc"),
            orderBy("createdAt", "desc")
          );
          break;
        case "lowest":
          reviewQuery = query(
            reviewQuery,
            orderBy("rating", "asc"),
            orderBy("createdAt", "desc")
          );
          break;
        case "helpful":
          reviewQuery = query(
            reviewQuery,
            orderBy("helpfulCount", "desc"),
            orderBy("createdAt", "desc")
          );
          break;
        case "newest":
        default:
          reviewQuery = query(reviewQuery, orderBy("createdAt", "desc"));
          break;
      }

      // Apply pagination
      reviewQuery = query(reviewQuery, limit(pageSize));

      // If there's a last document for pagination
      if (lastDoc) {
        reviewQuery = query(reviewQuery, startAfter(lastDoc));
      }

      const querySnapshot = await getDocs(reviewQuery);
      const reviews = [];
      const lastVisible = querySnapshot.docs[querySnapshot.docs.length - 1];

      // Process reviews
      for (const reviewDoc of querySnapshot.docs) {
        const reviewData = {
          id: reviewDoc.id,
          ...reviewDoc.data(),
          replies: [],
        };

        // Fetch review replies if requested
        if (withReplies && !reviewData.isDeleted) {
          const repliesRef = collection(db, "reviewReplies");
          const repliesQuery = query(
            repliesRef,
            where("reviewId", "==", reviewDoc.id),
            orderBy("createdAt", "asc")
          );

          const repliesSnapshot = await getDocs(repliesQuery);
          reviewData.replies = repliesSnapshot.docs.map((replyDoc) => ({
            id: replyDoc.id,
            ...replyDoc.data(),
          }));
        }

        reviews.push(reviewData);
      }

      return {
        success: true,
        data: reviews,
        lastVisible,
        hasMore: querySnapshot.docs.length === pageSize,
      };
    } catch (error) {
      console.error("Error getting product reviews:", error);
      return {
        success: false,
        error: error.message || "Failed to fetch reviews",
      };
    }
  }

  /**
   * Add a new review for a product
   * @param {Object} reviewData - Review data
   * @param {string} reviewData.productId - Product ID
   * @param {string} reviewData.userId - User ID
   * @param {string} reviewData.userName - User name
   * @param {string} reviewData.userPhotoURL - User photo URL
   * @param {number} reviewData.rating - Rating (1-5)
   * @param {string} reviewData.text - Review text
   * @returns {Promise<Object>} - Success or error
   */
  async addReview(reviewData) {
    try {
      // Check if user has already reviewed this product
      const reviewsRef = collection(db, "reviews");
      const q = query(
        reviewsRef,
        where("productId", "==", reviewData.productId),
        where("userId", "==", reviewData.userId)
      );

      const querySnapshot = await getDocs(q);

      // If user has already reviewed, update the existing review
      if (!querySnapshot.empty) {
        const existingReview = querySnapshot.docs[0];
        await updateDoc(doc(db, "reviews", existingReview.id), {
          rating: reviewData.rating,
          text: reviewData.text,
          updatedAt: serverTimestamp(),
        });

        // Return the updated review
        return {
          success: true,
          data: {
            id: existingReview.id,
            ...reviewData,
            updatedAt: new Date(),
          },
          message: "Review updated successfully",
        };
      }

      // Add timestamps and additional fields to new review
      const reviewWithTimestamp = {
        ...reviewData,
        createdAt: serverTimestamp(),
        helpfulCount: 0,
        helpfulVoters: [],
        isApproved: true, // Default to approved unless moderation is enabled
        isDeleted: false,
        status: "active", // Statuses: active, pending, rejected
      };

      // Add the new review
      const docRef = await addDoc(
        collection(db, "reviews"),
        reviewWithTimestamp
      );

      // Update product rating statistics
      await this.updateProductRating(reviewData.productId);

      // Check for first review achievement
      try {
        await achievementService.checkAchievement(
          "first_review",
          reviewData.userId
        );

        // Check for reviewer_5 achievement
        const userReviewsQuery = query(
          collection(db, "reviews"),
          where("userId", "==", reviewData.userId)
        );
        const userReviews = await getDocs(userReviewsQuery);

        if (userReviews.size >= 5) {
          await achievementService.checkAchievement(
            "reviewer_5",
            reviewData.userId
          );
        }
      } catch (err) {
        console.error("Error checking review achievements:", err);
        // Don't stop the flow if achievement check fails
      }

      return {
        success: true,
        data: {
          id: docRef.id,
          ...reviewData,
          createdAt: new Date(),
          helpfulCount: 0,
          helpfulVoters: [],
          isApproved: true,
          status: "active",
          replies: [],
        },
        message: "Review added successfully",
      };
    } catch (error) {
      console.error("Error adding review:", error);
      return {
        success: false,
        error: error.message || "Failed to add review",
      };
    }
  }

  /**
   * Mark a review as helpful or unhelpful
   * @param {string} reviewId - The review ID
   * @param {string} userId - The user ID
   * @param {boolean} isHelpful - Whether the review is helpful
   * @returns {Promise<Object>} - Success or error
   */
  async markReviewHelpful(reviewId, userId, isHelpful) {
    try {
      const reviewRef = doc(db, "reviews", reviewId);
      const reviewDoc = await getDoc(reviewRef);

      if (!reviewDoc.exists()) {
        return {
          success: false,
          error: "Review not found",
        };
      }

      const reviewData = reviewDoc.data();
      const helpfulVoters = reviewData.helpfulVoters || [];
      const hasVoted = helpfulVoters.includes(userId);

      // If the user has already voted and is voting the same way, remove their vote
      if (hasVoted && isHelpful) {
        await updateDoc(reviewRef, {
          helpfulVoters: arrayRemove(userId),
          helpfulCount: increment(-1),
        });

        return {
          success: true,
          data: {
            helpfulCount: (reviewData.helpfulCount || 0) - 1,
            hasVoted: false,
          },
          message: "Your vote has been removed",
        };
      }

      // If the user has not voted and wants to mark as helpful
      if (!hasVoted && isHelpful) {
        await updateDoc(reviewRef, {
          helpfulVoters: arrayUnion(userId),
          helpfulCount: increment(1),
        });

        return {
          success: true,
          data: {
            helpfulCount: (reviewData.helpfulCount || 0) + 1,
            hasVoted: true,
          },
          message: "Review marked as helpful",
        };
      }

      // If the user has voted but wants to remove their vote
      if (hasVoted && !isHelpful) {
        await updateDoc(reviewRef, {
          helpfulVoters: arrayRemove(userId),
          helpfulCount: increment(-1),
        });

        return {
          success: true,
          data: {
            helpfulCount: (reviewData.helpfulCount || 0) - 1,
            hasVoted: false,
          },
          message: "Your vote has been removed",
        };
      }

      return {
        success: true,
        data: {
          helpfulCount: reviewData.helpfulCount || 0,
          hasVoted: hasVoted,
        },
        message: "No change made",
      };
    } catch (error) {
      console.error("Error marking review as helpful:", error);
      return {
        success: false,
        error: error.message || "Failed to update review",
      };
    }
  }

  /**
   * Add a reply to a review
   * @param {Object} replyData - Reply data
   * @param {string} replyData.reviewId - Review ID
   * @param {string} replyData.userId - User ID
   * @param {string} replyData.userName - User name
   * @param {string} replyData.userPhotoURL - User photo URL
   * @param {string} replyData.text - Reply text
   * @param {boolean} replyData.isDesigner - Whether the replier is the product designer
   * @param {boolean} replyData.isAdmin - Whether the replier is an admin
   * @returns {Promise<Object>} - Success or error
   */
  async addReviewReply(replyData) {
    try {
      // Check if the review exists
      const reviewRef = doc(db, "reviews", replyData.reviewId);
      const reviewDoc = await getDoc(reviewRef);

      if (!reviewDoc.exists()) {
        return {
          success: false,
          error: "Review not found",
        };
      }

      // Add timestamps to reply
      const replyWithTimestamp = {
        ...replyData,
        createdAt: serverTimestamp(),
        isDeleted: false,
      };

      // Add reply to database
      const replyRef = collection(db, "reviewReplies");
      const docRef = await addDoc(replyRef, replyWithTimestamp);

      // Update review with reply count
      await updateDoc(reviewRef, {
        replyCount: increment(1),
      });

      return {
        success: true,
        data: {
          id: docRef.id,
          ...replyData,
          createdAt: new Date(),
          isDeleted: false,
        },
        message: "Reply added successfully",
      };
    } catch (error) {
      console.error("Error adding review reply:", error);
      return {
        success: false,
        error: error.message || "Failed to add reply",
      };
    }
  }

  /**
   * Delete a review reply
   * @param {string} replyId - The reply ID
   * @param {string} reviewId - The review ID
   * @returns {Promise<Object>} - Success or error
   */
  async deleteReviewReply(replyId, reviewId) {
    try {
      const replyRef = doc(db, "reviewReplies", replyId);
      const replyDoc = await getDoc(replyRef);

      if (!replyDoc.exists()) {
        return {
          success: false,
          error: "Reply not found",
        };
      }

      // Soft delete the reply
      await updateDoc(replyRef, {
        isDeleted: true,
        deletedAt: serverTimestamp(),
      });

      // Update the review's reply count
      const reviewRef = doc(db, "reviews", reviewId);
      await updateDoc(reviewRef, {
        replyCount: increment(-1),
      });

      return {
        success: true,
        message: "Reply deleted successfully",
      };
    } catch (error) {
      console.error("Error deleting review reply:", error);
      return {
        success: false,
        error: error.message || "Failed to delete reply",
      };
    }
  }

  /**
   * Moderate a review (approve, reject or delete)
   * @param {string} reviewId - The review ID
   * @param {string} action - The moderation action ('approve', 'reject', 'delete')
   * @param {string} moderatorId - The moderator's user ID
   * @param {string} reason - Reason for rejection (optional)
   * @returns {Promise<Object>} - Success or error
   */
  async moderateReview(reviewId, action, moderatorId, reason = "") {
    try {
      const reviewRef = doc(db, "reviews", reviewId);
      const reviewDoc = await getDoc(reviewRef);

      if (!reviewDoc.exists()) {
        return {
          success: false,
          error: "Review not found",
        };
      }

      const reviewData = reviewDoc.data();
      const productId = reviewData.productId;

      switch (action) {
        case "approve":
          await updateDoc(reviewRef, {
            isApproved: true,
            status: "active",
            moderatedBy: moderatorId,
            moderatedAt: serverTimestamp(),
          });
          break;
        case "reject":
          await updateDoc(reviewRef, {
            isApproved: false,
            status: "rejected",
            moderatedBy: moderatorId,
            moderatedAt: serverTimestamp(),
            rejectionReason: reason,
          });
          break;
        case "delete":
          // Soft delete
          await updateDoc(reviewRef, {
            isDeleted: true,
            status: "deleted",
            moderatedBy: moderatorId,
            moderatedAt: serverTimestamp(),
            deletedAt: serverTimestamp(),
          });
          break;
        default:
          return {
            success: false,
            error: "Invalid moderation action",
          };
      }

      // Update product rating statistics after moderation
      await this.updateProductRating(productId);

      return {
        success: true,
        message: `Review ${action}d successfully`,
      };
    } catch (error) {
      console.error("Error moderating review:", error);
      return {
        success: false,
        error: error.message || "Failed to moderate review",
      };
    }
  }

  /**
   * Update product rating statistics
   * @param {string} productId - The product ID
   * @returns {Promise<void>}
   */
  async updateProductRating(productId) {
    try {
      // Get all approved, non-deleted reviews for this product
      const reviewsRef = collection(db, "reviews");
      const q = query(
        reviewsRef,
        where("productId", "==", productId),
        where("isApproved", "==", true),
        where("isDeleted", "==", false)
      );

      const querySnapshot = await getDocs(q);
      const reviews = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      if (reviews.length === 0) {
        // If no valid reviews, set defaults
        const productRef = doc(db, "products", productId);
        await updateDoc(productRef, {
          averageRating: 0,
          reviewCount: 0,
          rating1Count: 0,
          rating2Count: 0,
          rating3Count: 0,
          rating4Count: 0,
          rating5Count: 0,
          updatedAt: serverTimestamp(),
        });
        return;
      }

      // Calculate average rating and rating distribution
      const totalRating = reviews.reduce(
        (sum, review) => sum + review.rating,
        0
      );
      const averageRating = totalRating / reviews.length;

      // Count ratings by star level
      const ratingCounts = {
        rating1Count: reviews.filter((review) => review.rating === 1).length,
        rating2Count: reviews.filter((review) => review.rating === 2).length,
        rating3Count: reviews.filter((review) => review.rating === 3).length,
        rating4Count: reviews.filter((review) => review.rating === 4).length,
        rating5Count: reviews.filter((review) => review.rating === 5).length,
      };

      // Update product with new rating data
      const productRef = doc(db, "products", productId);
      await updateDoc(productRef, {
        averageRating,
        reviewCount: reviews.length,
        ...ratingCounts,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Error updating product rating:", error);
      throw error;
    }
  }

  /**
   * Get pending reviews for moderation
   * @param {number} limit - Number of reviews to fetch
   * @param {Object} lastDoc - Last document for pagination
   * @returns {Promise<Object>} - Pending reviews or error
   */
  async getPendingReviews(limit = 20, lastDoc = null) {
    try {
      const reviewsRef = collection(db, "reviews");
      let pendingQuery = query(
        reviewsRef,
        where("status", "==", "pending"),
        orderBy("createdAt", "desc"),
        limit
      );

      if (lastDoc) {
        pendingQuery = query(pendingQuery, startAfter(lastDoc));
      }

      const querySnapshot = await getDocs(pendingQuery);
      const reviews = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      return {
        success: true,
        data: reviews,
        lastVisible: querySnapshot.docs[querySnapshot.docs.length - 1],
        hasMore: querySnapshot.docs.length === limit,
      };
    } catch (error) {
      console.error("Error getting pending reviews:", error);
      return {
        success: false,
        error: error.message || "Failed to fetch pending reviews",
      };
    }
  }

  /**
   * Get review details by ID
   * @param {string} reviewId - The review ID
   * @param {boolean} withReplies - Whether to include replies
   * @returns {Promise<Object>} - Review data or error
   */
  async getReviewById(reviewId, withReplies = true) {
    try {
      const reviewRef = doc(db, "reviews", reviewId);
      const reviewDoc = await getDoc(reviewRef);

      if (!reviewDoc.exists()) {
        return {
          success: false,
          error: "Review not found",
        };
      }

      const reviewData = {
        id: reviewDoc.id,
        ...reviewDoc.data(),
        replies: [],
      };

      // Fetch review replies if requested
      if (withReplies && !reviewData.isDeleted) {
        const repliesRef = collection(db, "reviewReplies");
        const repliesQuery = query(
          repliesRef,
          where("reviewId", "==", reviewId),
          orderBy("createdAt", "asc")
        );

        const repliesSnapshot = await getDocs(repliesQuery);
        reviewData.replies = repliesSnapshot.docs.map((replyDoc) => ({
          id: replyDoc.id,
          ...replyDoc.data(),
        }));
      }

      return {
        success: true,
        data: reviewData,
      };
    } catch (error) {
      console.error("Error getting review details:", error);
      return {
        success: false,
        error: error.message || "Failed to fetch review details",
      };
    }
  }

  /**
   * Get rating distribution for a product
   * @param {string} productId - The product ID
   * @returns {Promise<Object>} - Rating distribution or error
   */
  async getProductRatingDistribution(productId) {
    try {
      const productRef = doc(db, "products", productId);
      const productDoc = await getDoc(productRef);

      if (!productDoc.exists()) {
        return {
          success: false,
          error: "Product not found",
        };
      }

      const productData = productDoc.data();

      const distribution = {
        averageRating: productData.averageRating || 0,
        reviewCount: productData.reviewCount || 0,
        distribution: {
          5: productData.rating5Count || 0,
          4: productData.rating4Count || 0,
          3: productData.rating3Count || 0,
          2: productData.rating2Count || 0,
          1: productData.rating1Count || 0,
        },
      };

      return {
        success: true,
        data: distribution,
      };
    } catch (error) {
      console.error("Error getting rating distribution:", error);
      return {
        success: false,
        error: error.message || "Failed to fetch rating distribution",
      };
    }
  }
}

export const reviewService = new ReviewService();
export default reviewService;
