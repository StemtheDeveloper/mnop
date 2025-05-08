import { auth, db } from "../config/firebase";
import {
  FacebookAuthProvider,
  TwitterAuthProvider,
  signInWithPopup,
  linkWithPopup,
  getAdditionalUserInfo,
} from "firebase/auth";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { USER_ROLES } from "../context/UserContext";

// Initialize providers
const facebookProvider = new FacebookAuthProvider();
const twitterProvider = new TwitterAuthProvider();

/**
 * Social Media Integration Service
 * Provides methods for social login and social sharing
 */
const socialMediaService = {
  /**
   * Sign in with Facebook
   * @returns {Promise} Authentication result
   */
  signInWithFacebook: async () => {
    try {
      const result = await signInWithPopup(auth, facebookProvider);
      const user = result.user;

      // Check if this is a new user
      const isNewUser = getAdditionalUserInfo(result)?.isNewUser;

      if (isNewUser) {
        // Create a user document in Firestore for new Facebook sign-ins
        await setDoc(doc(db, "users", user.uid), {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || "Facebook User",
          photoURL: user.photoURL || null,
          roles: [USER_ROLES.CUSTOMER], // Default role for social sign-ins
          provider: "facebook",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        // Update last login time for existing users
        const userRef = doc(db, "users", user.uid);
        await setDoc(
          userRef,
          {
            lastLogin: serverTimestamp(),
            provider: "facebook",
          },
          { merge: true }
        );
      }

      return { success: true, user };
    } catch (error) {
      console.error("Facebook sign in error:", error);
      return {
        success: false,
        error: error.message,
        code: error.code,
      };
    }
  },

  /**
   * Sign in with Twitter
   * @returns {Promise} Authentication result
   */
  signInWithTwitter: async () => {
    try {
      const result = await signInWithPopup(auth, twitterProvider);
      const user = result.user;

      // Check if this is a new user
      const isNewUser = getAdditionalUserInfo(result)?.isNewUser;

      if (isNewUser) {
        // Create a user document in Firestore for new Twitter sign-ins
        await setDoc(doc(db, "users", user.uid), {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || "Twitter User",
          photoURL: user.photoURL || null,
          roles: [USER_ROLES.CUSTOMER], // Default role for social sign-ins
          provider: "twitter",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        // Update last login time for existing users
        const userRef = doc(db, "users", user.uid);
        await setDoc(
          userRef,
          {
            lastLogin: serverTimestamp(),
            provider: "twitter",
          },
          { merge: true }
        );
      }

      return { success: true, user };
    } catch (error) {
      console.error("Twitter sign in error:", error);
      return {
        success: false,
        error: error.message,
        code: error.code,
      };
    }
  },

  /**
   * Link current user account with Facebook
   * @returns {Promise} Linking result
   */
  linkAccountWithFacebook: async () => {
    try {
      if (!auth.currentUser) {
        throw new Error("No authenticated user");
      }

      const result = await linkWithPopup(auth.currentUser, facebookProvider);

      // Update user record
      const userRef = doc(db, "users", auth.currentUser.uid);
      await setDoc(
        userRef,
        {
          linkedProviders: {
            facebook: true,
          },
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      return { success: true, result };
    } catch (error) {
      console.error("Facebook account linking error:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  },

  /**
   * Link current user account with Twitter
   * @returns {Promise} Linking result
   */
  linkAccountWithTwitter: async () => {
    try {
      if (!auth.currentUser) {
        throw new Error("No authenticated user");
      }

      const result = await linkWithPopup(auth.currentUser, twitterProvider);

      // Update user record
      const userRef = doc(db, "users", auth.currentUser.uid);
      await setDoc(
        userRef,
        {
          linkedProviders: {
            twitter: true,
          },
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      return { success: true, result };
    } catch (error) {
      console.error("Twitter account linking error:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  },

  /**
   * Share content to Facebook
   * Opens a Facebook share dialog in a new window
   * @param {string} url - URL to share
   * @param {string} title - Title to share
   * @param {string} description - Description text
   * @param {string} hashtags - Comma-separated hashtags
   */
  shareToFacebook: (url, title, description, hashtags) => {
    const shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
      url
    )}&quote=${encodeURIComponent(title)}`;
    window.open(shareUrl, "facebook-share-dialog", "width=626,height=436");

    return { success: true };
  },

  /**
   * Share content to Twitter
   * Opens a Twitter share dialog in a new window
   * @param {string} url - URL to share
   * @param {string} text - Text to share
   * @param {string} hashtags - Comma-separated hashtags
   * @param {string} via - Twitter username to tag in the share
   */
  shareToTwitter: (url, text, hashtags, via) => {
    let shareUrl = `https://twitter.com/intent/tweet?url=${encodeURIComponent(
      url
    )}&text=${encodeURIComponent(text)}`;

    if (hashtags) {
      shareUrl += `&hashtags=${encodeURIComponent(hashtags)}`;
    }

    if (via) {
      shareUrl += `&via=${encodeURIComponent(via)}`;
    }

    window.open(shareUrl, "twitter-share-dialog", "width=626,height=436");

    return { success: true };
  },

  /**
   * Share content to LinkedIn
   * Opens a LinkedIn share dialog in a new window
   * @param {string} url - URL to share
   * @param {string} title - Title to share
   * @param {string} summary - Description text
   * @param {string} source - Source of the content
   */
  shareToLinkedIn: (url, title, summary, source) => {
    let shareUrl = `https://www.linkedin.com/shareArticle?mini=true&url=${encodeURIComponent(
      url
    )}`;

    if (title) {
      shareUrl += `&title=${encodeURIComponent(title)}`;
    }

    if (summary) {
      shareUrl += `&summary=${encodeURIComponent(summary)}`;
    }

    if (source) {
      shareUrl += `&source=${encodeURIComponent(source)}`;
    }

    window.open(shareUrl, "linkedin-share-dialog", "width=626,height=436");

    return { success: true };
  },

  /**
   * Share content to Pinterest
   * Opens a Pinterest share dialog in a new window
   * @param {string} url - URL to share
   * @param {string} media - URL to the image
   * @param {string} description - Description text
   */
  shareToPinterest: (url, media, description) => {
    const shareUrl = `https://pinterest.com/pin/create/button/?url=${encodeURIComponent(
      url
    )}&media=${encodeURIComponent(media)}&description=${encodeURIComponent(
      description
    )}`;

    window.open(shareUrl, "pinterest-share-dialog", "width=626,height=436");

    return { success: true };
  },

  /**
   * Create a shareable URL for WhatsApp
   * @param {string} url - URL to share
   * @param {string} text - Text to share
   * @returns {string} WhatsApp sharing URL
   */
  getWhatsAppShareUrl: (url, text) => {
    return `https://api.whatsapp.com/send?text=${encodeURIComponent(
      text + " " + url
    )}`;
  },

  /**
   * Create a shareable URL for Email
   * @param {string} url - URL to share
   * @param {string} subject - Email subject
   * @param {string} body - Email body
   * @returns {string} Email sharing URL
   */
  getEmailShareUrl: (url, subject, body) => {
    return `mailto:?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body + " " + url)}`;
  },
};

export default socialMediaService;
