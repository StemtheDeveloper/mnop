// filepath: c:\Users\GGPC\Desktop\mnop-app\src\services\twoFactorAuthService.js
import { doc, getDoc, updateDoc, setDoc } from "firebase/firestore";
import {
  RecaptchaVerifier,
  PhoneAuthProvider,
  signInWithPhoneNumber,
  multiFactor,
  PhoneMultiFactorGenerator,
  getMultiFactorResolver,
  getAuth,
  EmailAuthProvider,
  reauthenticateWithCredential,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { db, auth } from "../config/firebase";
import { getVerifier, resetVerifier } from "./recaptchaSingleton";

class TwoFactorAuthService {
  /**
   * Check if multi-factor authentication is enabled for a user
   * @param {string} userId - The user's ID
   * @returns {Promise<Object>} - Result with MFA status
   */
  async get2FAStatus(userId) {
    try {
      const userRef = doc(db, "users", userId);
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) {
        return { success: false, error: "User not found" };
      }

      const userData = userDoc.data();
      const twoFactorAuth = userData.twoFactorAuth || {
        enabled: false,
        verified: false,
      };

      return {
        success: true,
        data: {
          enabled: twoFactorAuth.enabled === true,
          verified: twoFactorAuth.verified === true,
          phoneNumber: twoFactorAuth.phoneNumber || null,
          backupCodesGenerated:
            Array.isArray(twoFactorAuth.backupCodes) &&
            twoFactorAuth.backupCodes.length > 0,
        },
      };
    } catch (error) {
      console.error("Error getting 2FA status:", error);
      return {
        success: false,
        error: error.message || "Failed to get 2FA status",
      };
    }
  }

  /**
   * Enroll a user in multi-factor authentication using phone
   * @param {Object} user - Firebase user object
   * @param {string} phoneNumber - The phone number to use for MFA
   * @returns {Promise<Object>} - Object containing verification session info
   */
  async enrollWithPhoneNumber(user, phoneNumber) {
    try {
      // Format phone number to ensure it has a country code
      let formattedPhone = phoneNumber;

      // Clean the phone number of any formatting
      const cleanNumber = phoneNumber.replace(/\D/g, "");

      // Check if the number already has a country code (starts with +)
      if (!phoneNumber.startsWith("+")) {
        // Handle New Zealand numbers (start with 02)
        if (cleanNumber.startsWith("02")) {
          formattedPhone = `+64${cleanNumber.substring(1)}`; // Replace the '0' with NZ country code
        } else {
          // Default to US format for backward compatibility
          formattedPhone = `+1${cleanNumber}`;
        }
      }

      console.log("Using formatted phone number:", formattedPhone);

      // Make sure user is recently signed in
      const multiFactorUser = multiFactor(user);

      // Reset recaptcha before starting a new phone verification
      resetVerifier();

      // Start the enrollment process
      const session = await multiFactorUser.getSession();

      // Request verification code be sent to the user's phone
      const phoneInfoOptions = {
        phoneNumber: formattedPhone,
        session,
      };

      // Send verification code to phone
      const verifier = getVerifier();
      const phoneAuthProvider = new PhoneAuthProvider(auth);
      const verificationId = await phoneAuthProvider.verifyPhoneNumber(
        phoneInfoOptions,
        verifier
      );

      // Store the phone number in user document
      await this.updatePhoneNumber(user.uid, formattedPhone);

      return {
        success: true,
        verificationId,
        phoneNumber: formattedPhone,
      };
    } catch (error) {
      console.error("Error enrolling with phone number:", error);

      // Check specifically for requires-recent-login error
      if (error.code === "auth/requires-recent-login") {
        return {
          success: false,
          error: "Recent authentication required",
          requiresReauth: true,
          code: error.code,
        };
      }

      return {
        success: false,
        error: error.message || "Failed to send verification code",
        code: error.code || null,
        requiresReauth: error.code === "auth/requires-recent-login",
      };
    }
  }

  /**
   * Complete enrollment after code verification
   * @param {Object} user - Firebase user object
   * @param {string} verificationId - Verification ID from enrollWithPhoneNumber
   * @param {string} verificationCode - Code entered by user
   * @returns {Promise<Object>} - Result with success status
   */
  async completeEnrollment(user, verificationId, verificationCode) {
    try {
      // Create credential from verification ID and code
      const phoneAuthCredential = PhoneAuthProvider.credential(
        verificationId,
        verificationCode
      );

      // Create multi-factor assertion
      const multiFactorAssertion =
        PhoneMultiFactorGenerator.assertion(phoneAuthCredential);

      // Complete enrollment
      const multiFactorUser = multiFactor(user);
      await multiFactorUser.enroll(multiFactorAssertion, "My phone number");

      // Update user document in Firestore
      await this.updateUserMfaStatus(user.uid, true, true);

      return {
        success: true,
        message: "Multi-factor authentication enrolled successfully",
      };
    } catch (error) {
      console.error("Error completing MFA enrollment:", error);
      return {
        success: false,
        error: error.message || "Failed to verify code and enable MFA",
      };
    }
  }

  /**
   * Handle MFA sign-in when prompted during login
   * @param {Error} error - The auth error that triggered MFA
   * @returns {Promise<Object>} - Info needed for the next step
   */
  async handleMfaRequired(error) {
    try {
      // Get the resolver from the error
      const resolver = getMultiFactorResolver(auth, error);

      // Get enrolled second factors
      const hints = resolver.hints;

      // Make sure we have hints
      if (!hints || hints.length === 0) {
        return {
          success: false,
          error: "No multi-factor authentication methods found",
        };
      }

      // Reset recaptcha before starting a new phone verification
      resetVerifier();

      // We'll handle the first phone hint
      const phoneInfoOptions = {
        multiFactorHint: hints[0],
        session: resolver.session,
      };

      // Send verification code
      const phoneAuthProvider = new PhoneAuthProvider(auth);
      const verificationId = await phoneAuthProvider.verifyPhoneNumber(
        phoneInfoOptions,
        getVerifier()
      );

      return {
        success: true,
        verificationId,
        resolver,
      };
    } catch (error) {
      console.error("Error handling MFA:", error);
      return {
        success: false,
        error: error.message || "Failed to start MFA verification",
      };
    }
  }

  /**
   * Complete MFA sign-in with verification code
   * @param {Object} resolver - MFA resolver from handleMfaRequired
   * @param {string} verificationId - Verification ID from handleMfaRequired
   * @param {string} verificationCode - Code entered by user
   * @returns {Promise<Object>} - Result with user credential
   */
  async completeMfaSignIn(resolver, verificationId, verificationCode) {
    try {
      // Create credential from verification ID and code
      const phoneAuthCredential = PhoneAuthProvider.credential(
        verificationId,
        verificationCode
      );

      // Create multi-factor assertion
      const multiFactorAssertion =
        PhoneMultiFactorGenerator.assertion(phoneAuthCredential);

      // Complete sign-in
      const userCredential = await resolver.resolveSignIn(multiFactorAssertion);

      return {
        success: true,
        credential: userCredential,
      };
    } catch (error) {
      console.error("Error completing MFA sign-in:", error);
      return {
        success: false,
        error: error.message || "Invalid verification code",
      };
    }
  }

  /**
   * Update the user's MFA status in Firestore
   * @param {string} userId - The user's ID
   * @param {boolean} enabled - Whether MFA is enabled
   * @param {boolean} verified - Whether MFA is verified
   * @returns {Promise<Object>} - Result with success status
   */
  async updateUserMfaStatus(userId, enabled = true, verified = true) {
    try {
      const userRef = doc(db, "users", userId);

      await updateDoc(userRef, {
        "twoFactorAuth.enabled": enabled,
        "twoFactorAuth.verified": verified,
        "twoFactorAuth.lastUpdated": new Date(),
        updatedAt: new Date(),
      });

      return { success: true };
    } catch (error) {
      console.error("Error updating MFA status:", error);
      return {
        success: false,
        error: error.message || "Failed to update MFA status",
      };
    }
  }

  /**
   * Update a user's phone number
   * @param {string} userId - User ID
   * @param {string} phoneNumber - Phone number
   * @returns {Promise<Object>} - Result with success status
   */
  async updatePhoneNumber(userId, phoneNumber) {
    try {
      const userRef = doc(db, "users", userId);

      await updateDoc(userRef, {
        "twoFactorAuth.phoneNumber": phoneNumber,
        updatedAt: new Date(),
      });

      return { success: true };
    } catch (error) {
      console.error("Error updating phone number:", error);
      return {
        success: false,
        error: error.message || "Failed to update phone number",
      };
    }
  }

  /**
   * Enable 2FA for a user
   * @param {string} userId - User ID
   * @param {string} secret - The secret for 2FA
   * @param {boolean} verified - Whether the 2FA is verified
   * @returns {Promise<Object>} - Result with success status
   */
  async enable2FA(userId, secret, verified = false) {
    try {
      const userRef = doc(db, "users", userId);

      await updateDoc(userRef, {
        "twoFactorAuth.enabled": true,
        "twoFactorAuth.secret": secret,
        "twoFactorAuth.verified": verified,
        "twoFactorAuth.lastUpdated": new Date(),
        updatedAt: new Date(),
      });

      return { success: true, message: "Two-factor authentication enabled" };
    } catch (error) {
      console.error("Error enabling 2FA:", error);
      return {
        success: false,
        error: error.message || "Failed to enable 2FA",
      };
    }
  }

  /**
   * Disable 2FA for a user
   * @param {string} userId - User ID
   * @returns {Promise<Object>} - Result with success status
   */
  async disable2FA(userId) {
    try {
      const userRef = doc(db, "users", userId);

      await updateDoc(userRef, {
        "twoFactorAuth.enabled": false,
        "twoFactorAuth.verified": false,
        "twoFactorAuth.lastUpdated": new Date(),
        updatedAt: new Date(),
      });

      return { success: true, message: "Two-factor authentication disabled" };
    } catch (error) {
      console.error("Error disabling 2FA:", error);
      return {
        success: false,
        error: error.message || "Failed to disable 2FA",
      };
    }
  }

  /**
   * Generate random backup codes
   * @param {number} count - Number of backup codes to generate
   * @returns {Array<string>} - Array of backup codes
   */
  generateBackupCodes(count = 10) {
    const codes = [];

    for (let i = 0; i < count; i++) {
      // Create a random 10-character alphanumeric code
      let code = "";
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

      for (let j = 0; j < 10; j++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }

      // Format as XXXXX-XXXXX for readability
      code = code.substring(0, 5) + "-" + code.substring(5);
      codes.push(code);
    }

    return codes;
  }

  /**
   * Save backup codes for a user
   * @param {string} userId - The user's ID
   * @param {Array<string>} backupCodes - Array of backup codes
   * @returns {Promise<Object>} - Result with success status
   */
  async saveBackupCodes(userId, backupCodes) {
    try {
      const userRef = doc(db, "users", userId);

      await updateDoc(userRef, {
        "twoFactorAuth.backupCodes": backupCodes,
        updatedAt: new Date(),
      });

      return { success: true, message: "Backup codes saved successfully" };
    } catch (error) {
      console.error("Error saving backup codes:", error);
      return {
        success: false,
        error: error.message || "Failed to save backup codes",
      };
    }
  }

  /**
   * Check if 2FA is required for a user based on their roles
   * @param {Array<string>} userRoles - Array of user roles
   * @returns {boolean} - Whether 2FA is required
   */
  is2FARequiredForRoles(userRoles) {
    // Check if the user has admin or designer role
    return userRoles.includes("admin") || userRoles.includes("designer");
  }

  /**
   * Verify a backup code for a user
   * @param {string} userId - The user's ID
   * @param {string} backupCode - The backup code to verify
   * @returns {Promise<Object>} - Result with success status
   */
  async verifyBackupCode(userId, backupCode) {
    try {
      const userRef = doc(db, "users", userId);
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) {
        return { success: false, error: "User not found" };
      }

      const userData = userDoc.data();
      const twoFactorAuth = userData.twoFactorAuth || {};
      const backupCodes = twoFactorAuth.backupCodes || [];

      // Normalize the backup code format (remove dashes, uppercase)
      const normalizedInputCode = backupCode.replace(/-/g, "").toUpperCase();
      const normalizedStoredCodes = backupCodes.map((code) =>
        code.replace(/-/g, "").toUpperCase()
      );

      const index = normalizedStoredCodes.indexOf(normalizedInputCode);

      if (index === -1) {
        return { success: false, error: "Invalid backup code" };
      }

      // Remove the used backup code
      backupCodes.splice(index, 1);

      // Update the user document
      await updateDoc(userRef, {
        "twoFactorAuth.backupCodes": backupCodes,
        updatedAt: new Date(),
      });

      return { success: true, message: "Backup code verified successfully" };
    } catch (error) {
      console.error("Error verifying backup code:", error);
      return {
        success: false,
        error: error.message || "Failed to verify backup code",
      };
    }
  }

  /**
   * Get the current multi-factor auth configuration for a user
   * @param {Object} user - Firebase user object
   * @returns {Promise<Object>} - MFA configuration info
   */
  getMfaInfo(user) {
    try {
      if (!user) {
        return {
          enrolled: false,
          factors: [],
        };
      }

      const multiFactorUser = multiFactor(user);
      const enrolledFactors = multiFactorUser.enrolledFactors || [];

      return {
        enrolled: enrolledFactors.length > 0,
        factors: enrolledFactors.map((factor) => ({
          uid: factor.uid,
          displayName: factor.displayName,
          factorId: factor.factorId,
          enrollmentTime: factor.enrollmentTime,
        })),
      };
    } catch (error) {
      console.error("Error getting MFA info:", error);
      return {
        enrolled: false,
        factors: [],
        error: error.message,
      };
    }
  }

  /**
   * Sign in with MFA using email, password and verification code
   * @param {string} email - User email
   * @param {string} password - User password
   * @param {string} phoneNumber - Phone number
   * @param {string} verificationCode - Code from SMS
   * @returns {Promise<Object>} - Result with credential or error
   */
  async signInWithMfa(email, password, phoneNumber, verificationCode) {
    try {
      try {
        // Try regular sign in first
        const credential = await signInWithEmailAndPassword(
          auth,
          email,
          password
        );
        return { success: true, credential, mfaRequired: false };
      } catch (err) {
        if (err.code !== "auth/multi-factor-auth-required") throw err;

        // Get the resolver from the error
        const resolver = getMultiFactorResolver(auth, err);

        // Find the matching phone hint
        const phoneInfo = resolver.hints.find(
          (h) => h.phoneNumber === phoneNumber
        );

        if (!phoneInfo) {
          throw new Error("Phone number not found in enrolled factors");
        }

        // Reset recaptcha and send verification code via SMS
        resetVerifier();
        const verificationId = await new PhoneAuthProvider(
          auth
        ).verifyPhoneNumber(
          {
            session: resolver.session,
            phoneNumber: phoneInfo.phoneNumber,
          },
          getVerifier()
        );

        // Verify the code
        const phoneCred = PhoneAuthProvider.credential(
          verificationId,
          verificationCode
        );
        const mfaAssertion = PhoneMultiFactorGenerator.assertion(phoneCred);
        const userCredential = await resolver.resolveSignIn(mfaAssertion);

        return {
          success: true,
          credential: userCredential,
          mfaRequired: true,
        };
      }
    } catch (error) {
      console.error("Error in MFA sign in:", error);
      return {
        success: false,
        error: error.message || "Failed to sign in with MFA",
      };
    }
  }

  /**
   * Enrol with phone number as second factor
   * @param {string} email - User email
   * @param {string} password - User password
   * @param {string} phoneNumber - Phone number for 2FA
   * @param {string} verificationCode - Code from SMS
   * @returns {Promise<Object>} - Result
   */
  async enrolWithPhoneNumber(email, password, phoneNumber, verificationCode) {
    try {
      // Sign in first
      const userCred = await signInWithEmailAndPassword(auth, email, password);

      // Reset recaptcha before starting enrollment
      resetVerifier();

      // Start MFA enrollment
      const session = await multiFactor(userCred.user).getSession();

      // Send verification code
      const verificationId = await new PhoneAuthProvider(
        auth
      ).verifyPhoneNumber({ phoneNumber, session }, getVerifier());

      // Complete enrollment with the code
      const phoneCred = PhoneAuthProvider.credential(
        verificationId,
        verificationCode
      );
      await multiFactor(userCred.user).enroll(phoneCred, "Primary phone");

      // Update user document in Firestore
      await this.updatePhoneNumber(userCred.user.uid, phoneNumber);
      await this.updateUserMfaStatus(userCred.user.uid, true, true);

      return {
        success: true,
        message: "Multi-factor authentication enrolled successfully",
      };
    } catch (error) {
      console.error("Error enrolling with phone:", error);
      return {
        success: false,
        error: error.message || "Failed to enroll with phone number",
      };
    }
  }
}

const twoFactorAuthService = new TwoFactorAuthService();
export default twoFactorAuthService;

// Static methods for direct import
export const { enrolWithPhoneNumber, signInWithMfa } = {
  enrolWithPhoneNumber: async (email, password, phone, code) => {
    return twoFactorAuthService.enrolWithPhoneNumber(
      email,
      password,
      phone,
      code
    );
  },
  signInWithMfa: async (email, password, phone, code) => {
    return twoFactorAuthService.signInWithMfa(email, password, phone, code);
  },
};
