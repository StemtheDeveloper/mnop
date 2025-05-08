import { db } from "../config/firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
} from "firebase/firestore";

const verificationService = {
  // Get user verification status
  getUserVerificationStatus: async (userId) => {
    try {
      const userDoc = await getDoc(doc(db, "users", userId));
      if (!userDoc.exists()) {
        throw new Error("User not found");
      }

      const userData = userDoc.data();
      return {
        manufacturerVerified: userData.manufacturerVerified || false,
        designerVerified: userData.designerVerified || false,
        pendingVerification: userData.pendingVerification || [],
        roles: Array.isArray(userData.roles)
          ? userData.roles
          : userData.role
          ? [userData.role]
          : ["customer"],
      };
    } catch (error) {
      console.error("Error getting user verification status:", error);
      throw error;
    }
  },

  // Submit a verification request
  submitVerificationRequest: async (userId, role, data) => {
    try {
      // Check if the role is valid
      if (!["manufacturer", "designer"].includes(role)) {
        return {
          success: false,
          error:
            "Invalid role type. Only manufacturer or designer can be verified.",
        };
      }

      // First, check if user already has a pending request
      const userDoc = await getDoc(doc(db, "users", userId));
      if (!userDoc.exists()) {
        return {
          success: false,
          error: "User not found",
        };
      }

      const userData = userDoc.data();
      const pendingVerification = userData.pendingVerification || [];

      if (pendingVerification.includes(role)) {
        return {
          success: false,
          error: `You already have a pending verification request for ${role}.`,
        };
      }

      // Check if user is already verified
      if (
        (role === "manufacturer" && userData.manufacturerVerified) ||
        (role === "designer" && userData.designerVerified)
      ) {
        return {
          success: false,
          error: `You are already verified as a ${role}.`,
        };
      }

      // Create verification request document
      const requestData = {
        userId,
        role,
        status: "pending",
        businessInfo: {
          ...data,
        },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const docRef = await addDoc(
        collection(db, "verificationRequests"),
        requestData
      );

      // Update user document to mark role as pending verification
      await updateDoc(doc(db, "users", userId), {
        pendingVerification: arrayUnion(role),
        updatedAt: serverTimestamp(),
      });

      return {
        success: true,
        message: "Verification request submitted successfully",
        requestId: docRef.id,
      };
    } catch (error) {
      console.error("Error submitting verification request:", error);
      return {
        success: false,
        error: error.message || "Failed to submit verification request",
      };
    }
  },

  // Get all verification requests for admin
  getVerificationRequests: async (status = "pending") => {
    try {
      const q = query(
        collection(db, "verificationRequests"),
        where("status", "==", status),
        orderBy("createdAt", "desc")
      );

      const querySnapshot = await getDocs(q);
      const requests = [];

      for (const docSnapshot of querySnapshot.docs) {
        const requestData = docSnapshot.data();
        // Get user data to include in request
        const userDoc = await getDoc(doc(db, "users", requestData.userId));

        if (userDoc.exists()) {
          const userData = userDoc.data();
          requests.push({
            id: docSnapshot.id,
            ...requestData,
            user: {
              id: requestData.userId,
              displayName: userData.displayName || "Unknown",
              email: userData.email || "No email",
              photoURL: userData.photoURL || null,
            },
            createdAt: requestData.createdAt?.toDate() || new Date(),
          });
        } else {
          // Even if user doesn't exist, include the request
          requests.push({
            id: docSnapshot.id,
            ...requestData,
            user: {
              id: requestData.userId,
              displayName: "Unknown User",
              email: "User not found",
              photoURL: null,
            },
            createdAt: requestData.createdAt?.toDate() || new Date(),
          });
        }
      }

      return requests;
    } catch (error) {
      console.error("Error getting verification requests:", error);
      throw error;
    }
  },

  // Approve a verification request
  approveVerificationRequest: async (requestId) => {
    try {
      // Get the request details
      const requestDoc = await getDoc(
        doc(db, "verificationRequests", requestId)
      );
      if (!requestDoc.exists()) {
        return {
          success: false,
          error: "Verification request not found",
        };
      }

      const requestData = requestDoc.data();
      const { userId, role } = requestData;

      // Update the request status
      await updateDoc(doc(db, "verificationRequests", requestId), {
        status: "approved",
        updatedAt: serverTimestamp(),
        adminNote: "Approved verification",
      });

      // Update user's verification status
      const verificationField =
        role === "manufacturer" ? "manufacturerVerified" : "designerVerified";
      await updateDoc(doc(db, "users", userId), {
        [verificationField]: true,
        pendingVerification: arrayRemove(role),
        updatedAt: serverTimestamp(),
      });

      // Create a notification for the user
      await addDoc(collection(db, "notifications"), {
        userId,
        title: "Verification Approved",
        message: `Your ${role} verification has been approved.`,
        type: "verification_approved",
        read: false,
        createdAt: serverTimestamp(),
      });

      return {
        success: true,
        message: "Verification request approved successfully",
      };
    } catch (error) {
      console.error("Error approving verification request:", error);
      return {
        success: false,
        error: error.message || "Failed to approve verification request",
      };
    }
  },

  // Reject a verification request
  rejectVerificationRequest: async (requestId, reason) => {
    try {
      // Get the request details
      const requestDoc = await getDoc(
        doc(db, "verificationRequests", requestId)
      );
      if (!requestDoc.exists()) {
        return {
          success: false,
          error: "Verification request not found",
        };
      }

      const requestData = requestDoc.data();
      const { userId, role } = requestData;

      // Update the request status
      await updateDoc(doc(db, "verificationRequests", requestId), {
        status: "rejected",
        rejectionReason: reason || "No reason provided",
        updatedAt: serverTimestamp(),
      });

      // Update user document to remove pending verification
      await updateDoc(doc(db, "users", userId), {
        pendingVerification: arrayRemove(role),
        updatedAt: serverTimestamp(),
      });

      // Create a notification for the user
      await addDoc(collection(db, "notifications"), {
        userId,
        title: "Verification Rejected",
        message: `Your ${role} verification request has been rejected. Reason: ${
          reason || "No reason provided"
        }`,
        type: "verification_rejected",
        read: false,
        createdAt: serverTimestamp(),
      });

      return {
        success: true,
        message: "Verification request rejected successfully",
      };
    } catch (error) {
      console.error("Error rejecting verification request:", error);
      return {
        success: false,
        error: error.message || "Failed to reject verification request",
      };
    }
  },

  // Revoke a verification
  revokeVerification: async (userId, role) => {
    try {
      // Check if role is valid
      if (!["manufacturer", "designer"].includes(role)) {
        return {
          success: false,
          error: "Invalid role type",
        };
      }

      const verificationField =
        role === "manufacturer" ? "manufacturerVerified" : "designerVerified";

      // Update user document to revoke verification
      await updateDoc(doc(db, "users", userId), {
        [verificationField]: false,
        updatedAt: serverTimestamp(),
      });

      // Create a notification for the user
      await addDoc(collection(db, "notifications"), {
        userId,
        title: "Verification Revoked",
        message: `Your ${role} verification status has been revoked. Please contact support if you have questions.`,
        type: "verification_revoked",
        read: false,
        createdAt: serverTimestamp(),
      });

      return {
        success: true,
        message: "Verification status revoked successfully",
      };
    } catch (error) {
      console.error("Error revoking verification:", error);
      return {
        success: false,
        error: error.message || "Failed to revoke verification status",
      };
    }
  },

  // Get all manufacturers (both verified and unverified)
  getAllManufacturers: async () => {
    try {
      const usersRef = collection(db, "users");
      const manufacturersQuery = query(
        usersRef,
        where("roles", "array-contains", "manufacturer")
      );

      const querySnapshot = await getDocs(manufacturersQuery);
      const manufacturers = [];

      querySnapshot.forEach((docSnapshot) => {
        const userData = docSnapshot.data();
        manufacturers.push({
          id: docSnapshot.id,
          displayName:
            userData.displayName || userData.email || "Unnamed Manufacturer",
          email: userData.email || "",
          verified: userData.manufacturerVerified === true,
          ...userData,
        });
      });

      return manufacturers;
    } catch (error) {
      console.error("Error getting manufacturers:", error);
      throw error;
    }
  },
};

export default verificationService;
