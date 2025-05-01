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

// Import the recaptcha helper if available or create a placeholder
let getRecaptchaVerifier = () => null;
let resetRecaptcha = () => {};

try {
  const recaptchaModule = require("./recaptcha");
  getRecaptchaVerifier = recaptchaModule.getRecaptchaVerifier;
  resetRecaptcha = recaptchaModule.resetRecaptcha;
} catch (error) {
  console.warn("Recaptcha helper module not available");
}

class TwoFactorAuthService {
  /**
   * Initialize the recaptcha verifier needed for SMS verification
   * @param {string} containerId - DOM element ID for the reCAPTCHA container
   * @returns {RecaptchaVerifier} - The reCAPTCHA verifier instance
   */
  initRecaptchaVerifier(containerId = "recaptcha-container") {
    try {
      const container = document.getElementById(containerId);
      if (!container) {
        throw new Error(
          `reCAPTCHA container with ID '${containerId}' not found in DOM`
        );
      }

      // Clear any existing reCAPTCHA instances
      container.innerHTML = "";

      // Make sure the container is visible in the DOM
      container.style.display = "block";

      // Create a new RecaptchaVerifier instance with clear parameters
      const recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
        size: "invisible",
        callback: () => {
          console.log("reCAPTCHA verified");
        },
        "expired-callback": () => {
          console.log("reCAPTCHA expired");
        },
      });

      // Render the reCAPTCHA to make sure it's properly initialized
      recaptchaVerifier.render();

      return recaptchaVerifier;
    } catch (error) {
      console.error("Error initializing recaptcha:", error);
      throw error;
    }
  }

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
   * @param {string} recaptchaContainerId - DOM element ID for the reCAPTCHA container
   * @returns {Promise<Object>} - Object containing verification session info
   */
  async enrollWithPhoneNumber(user, phoneNumber, recaptchaContainerId) {
    try {
      // Make sure user is recently signed in
      const multiFactorUser = multiFactor(user);

      // Create and render the reCAPTCHA verifier
      const recaptchaVerifier =
        this.initRecaptchaVerifier(recaptchaContainerId);

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

      // Start the enrollment process
      const session = await multiFactorUser.getSession();

      // Request verification code be sent to the user's phone
      const phoneInfoOptions = {
        phoneNumber: formattedPhone,
        session,
      };

      // Send verification code to phone
      const phoneAuthProvider = new PhoneAuthProvider(auth);
      const verificationId = await phoneAuthProvider.verifyPhoneNumber(
        phoneInfoOptions,
        recaptchaVerifier
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
      return {
        success: false,
        error: error.message || "Failed to send verification code",
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
   * @param {string} recaptchaContainerId - DOM element ID for reCAPTCHA
   * @returns {Promise<Object>} - Info needed for the next step
   */
  async handleMfaRequired(error, recaptchaContainerId) {
    try {
      // Get the resolver from the error
      const resolver = getMultiFactorResolver(auth, error);

      // Create and render reCAPTCHA
      const recaptchaVerifier =
        this.initRecaptchaVerifier(recaptchaContainerId);

      // Get enrolled second factors
      const hints = resolver.hints;

      // We'll handle the first phone hint
      const phoneInfoOptions = {
        multiFactorHint: hints[0],
        session: resolver.session,
      };

      // Send verification code
      const phoneAuthProvider = new PhoneAuthProvider(auth);
      const verificationId = await phoneAuthProvider.verifyPhoneNumber(
        phoneInfoOptions,
        recaptchaVerifier
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
   * Simplified enrollment with phone number (alternative implementation)
   * @param {string} email - User email
   * @param {string} password - User password
   * @param {string} phone - Phone number
   * @param {string} verificationCode - Verification code from SMS
   * @returns {Promise<Object>} - Result with success status
   */
  async simplifiedEnrollWithMfa(email, password, phone, verificationCode) {
    try {
      // 1. Log in with the primary factor (email/password)
      const cred = await signInWithEmailAndPassword(auth, email, password);

      // 2. Prepare & send the SMS for MFA enrollment
      resetRecaptcha();
      const session = await multiFactor(cred.user).getSession();
      const verificationId = await new PhoneAuthProvider(
        auth
      ).verifyPhoneNumber(
        { phoneNumber: phone, session },
        getRecaptchaVerifier()
      );

      // 3. Finalize enrollment with the verification code
      const phoneCred = PhoneAuthProvider.credential(
        verificationId,
        verificationCode
      );
      await multiFactor(cred.user).enroll(phoneCred, "Primary phone");

      // Update user document in Firestore
      await this.updatePhoneNumber(cred.user.uid, phone);
      await this.updateUserMfaStatus(cred.user.uid, true, true);

      return {
        success: true,
        message: "Multi-factor authentication enrolled successfully",
      };
    } catch (error) {
      console.error("Error in simplified MFA enrollment:", error);
      return {
        success: false,
        error: error.message || "Failed to enroll in MFA",
      };
    }
  }

  /**
   * Simplified sign in with MFA (alternative implementation)
   * @param {string} email - User email
   * @param {string} password - User password
   * @param {string} phone - Phone number
   * @param {string} verificationCode - Verification code from SMS
   * @returns {Promise<Object>} - Result with user credential or error
   */
  async simplifiedSignInWithMfa(email, password, phone, verificationCode) {
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

        // 1. Get the resolver that specifies the next MFA steps
        const resolver = err.resolver;
        const phoneInfo = resolver.hints.find((h) => h.phoneNumber === phone);

        if (!phoneInfo) {
          throw new Error("Phone number not found in enrolled factors");
        }

        // 2. Send verification code via SMS
        resetRecaptcha();
        const verificationId = await new PhoneAuthProvider(
          auth
        ).verifyPhoneNumber(
          {
            session: resolver.session,
            phoneNumber: phoneInfo.phoneNumber,
          },
          getRecaptchaVerifier()
        );

        // 3. Resolve sign-in with the verification code
        const phoneCred = PhoneAuthProvider.credential(
          verificationId,
          verificationCode
        );
        const mfaCred = PhoneMultiFactorGenerator.assertion(phoneCred);
        const userCredential = await resolver.resolveSignIn(mfaCred);

        return {
          success: true,
          credential: userCredential,
          mfaRequired: true,
        };
      }
    } catch (error) {
      console.error("Error in simplified MFA sign in:", error);
      return {
        success: false,
        error: error.message || "Failed to sign in with MFA",
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
   * Disable MFA for a user
   * @param {Object} user - Firebase user object
   * @param {string} password - User's current password for reauthentication
   * @param {string} email - User's email
   * @returns {Promise<Object>} - Result with success status
   */
  async disableMfa(user, email, password) {
    try {
      // Reauthenticate the user first
      const credential = EmailAuthProvider.credential(email, password);
      await reauthenticateWithCredential(user, credential);

      // Get enrolled factors
      const multiFactorUser = multiFactor(user);
      const enrolledFactors = multiFactorUser.enrolledFactors;

      // Unenroll all factors
      if (enrolledFactors.length > 0) {
        await multiFactorUser.unenroll(enrolledFactors[0]);
      }

      // Update user document in Firestore
      await this.updateUserMfaStatus(user.uid, false, false);

      return {
        success: true,
        message: "Multi-factor authentication disabled successfully",
      };
    } catch (error) {
      console.error("Error disabling MFA:", error);
      return {
        success: false,
        error: error.message || "Failed to disable MFA",
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

  // Helper functions to expose the simplified functions as standalone exports
  static enrolWithPhoneNumber = async (email, password, phone, codeFromUI) => {
    const service = new TwoFactorAuthService();
    return service.simplifiedEnrollWithMfa(email, password, phone, codeFromUI);
  };

  static signInWithMfa = async (email, password, phone, codeFromUI) => {
    const service = new TwoFactorAuthService();
    return service.simplifiedSignInWithMfa(email, password, phone, codeFromUI);
  };
}

// Export the static methods separately for direct import
export const { enrolWithPhoneNumber, signInWithMfa } = TwoFactorAuthService;

const twoFactorAuthService = new TwoFactorAuthService();
export default twoFactorAuthService;
