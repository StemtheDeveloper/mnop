import {
  PhoneAuthProvider,
  PhoneMultiFactorGenerator,
  multiFactor,
  getAuth,
} from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "../config/firebase";
import { getRecaptchaVerifier, resetRecaptcha } from "./infra/recaptcha";

/**
 * Two-factor authentication service
 * Handles phone-based 2FA operations
 */
class TwoFactorAuthService {
  constructor() {
    // Initialize auth but also provide a method to refresh it
    this.auth = getAuth();
    this._systemSettings = null;
    this._systemSettingsTimestamp = 0;

    // Add a method to refresh auth when needed
    this.refreshAuth = () => {
      this.auth = getAuth();
      return this.auth;
    };
  }

  /**
   * Get 2FA status for a user
   * @param {string} userId - User ID to check
   * @param {boolean} forceFresh - Whether to bypass any caching and get fresh status
   * @returns {Promise<Object>} Status object with enabled and verified flags
   */
  async get2FAStatus(userId, forceFresh = false) {
    try {
      // Use a cache buster to ensure we get the latest data
      const options = forceFresh ? { source: "server" } : {};
      const userDoc = await getDoc(doc(db, "users", userId), options);

      if (!userDoc.exists()) {
        return {
          success: false,
          error: "User document not found",
        };
      }

      const userData = userDoc.data();
      const twoFactorData = userData.twoFactorAuth || {};

      // Check for complete and valid 2FA setup
      const isEnabled = !!twoFactorData.enabled && !!twoFactorData.phoneNumber;

      return {
        success: true,
        data: {
          enabled: isEnabled,
          verified: !!twoFactorData.verified,
          phoneNumber: twoFactorData.phoneNumber || null,
        },
      };
    } catch (error) {
      console.error("Error getting 2FA status:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Check if 2FA is required for a user's roles
   * @param {Array<string>} roles - User roles
   * @returns {Promise<boolean>} Whether 2FA is required
   */
  async is2FARequiredForRoles(roles) {
    if (!roles || !Array.isArray(roles)) {
      return false;
    }

    try {
      // Get system settings (with 5-minute cache)
      const settings = await this._getSystemSettings();

      // If 2FA is not required system-wide, return false
      if (!settings.requireTwoFactorAuth) {
        return false;
      }

      // Check if any of the user's roles require 2FA
      return roles.some((role) => settings.requiredRoles.includes(role));
    } catch (error) {
      console.error("Error checking if 2FA is required:", error);

      // Default to previous hard-coded behavior if there's an error
      const defaultRequiredRoles = ["admin", "designer"];
      return roles.some((role) => defaultRequiredRoles.includes(role));
    }
  }

  /**
   * Get system security settings with caching
   * @private
   * @returns {Promise<Object>} System security settings
   */
  async _getSystemSettings() {
    const now = Date.now();
    const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

    // Return cached settings if available and not expired
    if (
      this._systemSettings &&
      now - this._systemSettingsTimestamp < CACHE_DURATION
    ) {
      return this._systemSettings;
    }

    try {
      const settingsRef = doc(db, "settings", "securitySettings");
      const settingsDoc = await getDoc(settingsRef);

      if (settingsDoc.exists()) {
        const data = settingsDoc.data();
        this._systemSettings = {
          requireTwoFactorAuth: data.requireTwoFactorAuth ?? true,
          requiredRoles: data.requiredRoles ?? ["admin", "designer"],
        };
      } else {
        // Default settings if none exist
        this._systemSettings = {
          requireTwoFactorAuth: true,
          requiredRoles: ["admin", "designer"],
        };
      }

      this._systemSettingsTimestamp = now;
      return this._systemSettings;
    } catch (error) {
      console.error("Error fetching system security settings:", error);
      // Return default settings
      return {
        requireTwoFactorAuth: true,
        requiredRoles: ["admin", "designer"],
      };
    }
  }

  /**
   * Send verification code to user's phone
   * @param {string} phoneNumber - Phone number in E.164 format (e.g., +16505551234)
   * @returns {Promise<Object>} Result object with session information
   */
  async sendVerificationCode(phoneNumber) {
    try {
      // Get fresh auth instance to ensure we have the latest state
      this.auth = getAuth();

      // Force a timeout to make sure auth state is fully processed
      await new Promise((resolve) => {
        setTimeout(() => {
          this.auth = getAuth();
          resolve();
        }, 1000);
      });

      if (!this.auth.currentUser) {
        console.error(
          "Authentication error: currentUser is null after refresh attempts"
        );
        throw new Error(
          "User is not authenticated. Please sign in again and retry."
        );
      }

      // Reset any existing recaptcha
      resetRecaptcha();

      // Get the singleton verifier instance
      const recaptchaVerifier = getRecaptchaVerifier();

      const multiFactorUser = multiFactor(this.auth.currentUser);
      const phoneAuthProvider = new PhoneAuthProvider(this.auth);

      // Send verification code
      const verificationId = await phoneAuthProvider.verifyPhoneNumber(
        phoneNumber,
        recaptchaVerifier
      );

      return {
        success: true,
        data: {
          verificationId,
          phoneNumber,
        },
      };
    } catch (error) {
      console.error("Error sending verification code:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Complete phone number verification and enroll in MFA
   * @param {string} verificationId - Verification ID from sendVerificationCode
   * @param {string} verificationCode - OTP code from SMS
   * @param {string} phoneNumber - Phone number being verified
   * @returns {Promise<Object>} Result object
   */
  async verifyPhoneAndEnroll(verificationId, verificationCode, phoneNumber) {
    try {
      // Get fresh auth instance to ensure we have the latest state
      this.auth = getAuth();

      // Force a timeout to make sure auth state is fully processed
      await new Promise((resolve) => {
        setTimeout(() => {
          this.auth = getAuth();
          resolve();
        }, 1000);
      });

      if (!this.auth.currentUser) {
        console.error(
          "Authentication error: currentUser is null after refresh attempts"
        );
        throw new Error(
          "User is not authenticated. Please sign in again and retry."
        );
      }

      const multiFactorUser = multiFactor(this.auth.currentUser);

      // Create credential
      const phoneAuthCredential = PhoneAuthProvider.credential(
        verificationId,
        verificationCode
      );

      // Create multi-factor assertion
      const multiFactorAssertion =
        PhoneMultiFactorGenerator.assertion(phoneAuthCredential);

      // Enroll the user in MFA
      await multiFactorUser.enroll(multiFactorAssertion, phoneNumber);

      // Update Firestore document
      await this.enable2FA(this.auth.currentUser.uid, phoneNumber, true);

      return {
        success: true,
        message: "Successfully enrolled in two-factor authentication",
      };
    } catch (error) {
      console.error("Error verifying phone and enrolling in MFA:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Enable 2FA for a user
   * @param {string} userId - User ID
   * @param {string} phoneNumber - Phone number for 2FA
   * @param {boolean} verified - Whether phone has been verified
   * @returns {Promise<Object>} Result object
   */
  async enable2FA(userId, phoneNumber, verified = false) {
    try {
      const userRef = doc(db, "users", userId);

      await updateDoc(userRef, {
        twoFactorAuth: {
          enabled: true,
          verified: verified,
          phoneNumber: phoneNumber,
          updatedAt: new Date(),
        },
        updatedAt: new Date(),
      });

      return {
        success: true,
        message: "Two-factor authentication enabled successfully",
      };
    } catch (error) {
      console.error("Error enabling 2FA:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Verify a code during the sign-in process
   * @param {object} resolver - MFA resolver from auth/multi-factor-auth-required error
   * @param {string} verificationCode - Code from SMS
   * @returns {Promise<Object>} Result with user credential
   */
  async verifySignInCode(resolver, verificationCode) {
    try {
      // Get the first phone hint
      const hint = resolver.hints[0];

      // Create phone credential
      const phoneAuthCredential = PhoneAuthProvider.credential(
        resolver.session.verificationId,
        verificationCode
      );

      // Create multi-factor assertion
      const multiFactorAssertion =
        PhoneMultiFactorGenerator.assertion(phoneAuthCredential);

      // Resolve sign in
      const credential = await resolver.resolveSignIn(multiFactorAssertion);

      return {
        success: true,
        credential,
      };
    } catch (error) {
      console.error("Error verifying sign-in code:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Disable 2FA for a user
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Result object
   */
  async disable2FA(userId) {
    try {
      const userRef = doc(db, "users", userId);

      // Complete reset of 2FA data to ensure all traces are removed
      await updateDoc(userRef, {
        twoFactorAuth: {
          enabled: false,
          verified: false,
          phoneNumber: null, // Clear the phone number to prevent reuse
          updatedAt: new Date(),
        },
        updatedAt: new Date(),
      });

      // Force the user's MFA enrollment to be removed from Firebase Auth
      // This is done silently, as we don't have direct access to the user object here
      try {
        // This is a best-effort attempt - the document update above is the primary action
        const auth = getAuth();
        if (auth.currentUser && auth.currentUser.uid === userId) {
          const multiFactorUser = multiFactor(auth.currentUser);
          // If there are enrolled factors, attempt to unenroll them
          const enrolledFactors = await multiFactorUser.getEnrolledFactors();

          if (enrolledFactors && enrolledFactors.length > 0) {
            // Unenroll each factor
            for (const factor of enrolledFactors) {
              try {
                await multiFactorUser.unenroll(factor);
              } catch (err) {
                console.warn("Could not unenroll factor:", err);
                // Continue with other factors
              }
            }
          }
        }
      } catch (err) {
        // Log but don't fail the operation if we can't clean up Firebase Auth
        console.warn("Could not remove 2FA from Firebase Auth:", err);
      }

      return {
        success: true,
        message: "Two-factor authentication disabled successfully",
      };
    } catch (error) {
      console.error("Error disabling 2FA:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Update phone number for 2FA
   * @param {string} userId - User ID
   * @param {string} phoneNumber - New phone number
   * @param {boolean} verified - Whether new phone is verified
   * @returns {Promise<Object>} Result object
   */
  async updatePhoneNumber(userId, phoneNumber, verified = false) {
    try {
      const userRef = doc(db, "users", userId);

      await updateDoc(userRef, {
        "twoFactorAuth.phoneNumber": phoneNumber,
        "twoFactorAuth.verified": verified,
        "twoFactorAuth.updatedAt": new Date(),
        updatedAt: new Date(),
      });

      return {
        success: true,
        message: "Phone number updated successfully",
      };
    } catch (error) {
      console.error("Error updating phone number:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

const twoFactorAuthService = new TwoFactorAuthService();
export default twoFactorAuthService;
