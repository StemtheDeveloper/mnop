import {
  auth,
  db,
  PhoneAuthProvider,
  PhoneMultiFactorGenerator,
  RecaptchaVerifier,
  multiFactor,
  signInWithEmailAndPassword,
} from "../config/firebase";
import { doc, updateDoc } from "firebase/firestore";

// Store the current MFA session and resolver globally
let resolver = null;
let recaptchaVerifier = null;
let selectedIndex = null;
let verificationId = null;

/**
 * Validates a phone number format
 * @param {string} phoneNumber - The phone number to validate
 * @returns {string} Properly formatted phone number
 */
const validatePhoneNumber = (phoneNumber) => {
  // Remove any non-digit characters except the leading +
  let cleaned = phoneNumber.replace(/[^\d+]/g, "");

  // Ensure it starts with +
  if (!cleaned.startsWith("+")) {
    cleaned = "+" + cleaned;
  }

  // Basic pattern check (has + followed by at least 6 digits)
  const phonePattern = /^\+\d{6,}$/;
  if (!phonePattern.test(cleaned)) {
    throw new Error(
      "Invalid phone number format. Please use international format with + (e.g., +12345678901)"
    );
  }

  return cleaned;
};

/**
 * Service for handling two-factor authentication with Firebase
 * Supports MFA enrollment and verification
 */
const twoFactorAuthService = {
  /**
   * Get the current reCAPTCHA verifier instance
   * @returns {RecaptchaVerifier|null} The current reCAPTCHA verifier
   */
  getRecaptchaVerifier() {
    return recaptchaVerifier;
  },

  /**
   * Handle a multi-factor auth required error
   * @param {Object} error - Firebase auth error with code 'auth/multi-factor-required'
   * @returns {Object} MFA session information including enrolled factors
   */
  handleMfaRequired(error) {
    if (error.code !== "auth/multi-factor-required") {
      throw new Error("Not a multi-factor authentication error");
    }

    // Get the resolver from the error
    resolver = error.resolver;

    // Return hints about the second factors
    return {
      hints: resolver.hints,
      session: resolver.session,
    };
  },

  /**
   * Initialize reCAPTCHA verifier for phone authentication
   * @param {string} containerId - DOM ID of container for reCAPTCHA
   * @param {boolean} invisible - Whether to use invisible reCAPTCHA
   */
  initRecaptchaVerifier(containerId = "recaptcha-container", invisible = true) {
    try {
      // Clean up any existing instance
      if (recaptchaVerifier) {
        try {
          recaptchaVerifier.clear();
        } catch (e) {
          console.warn("Error clearing reCAPTCHA verifier:", e);
        }
        recaptchaVerifier = null;
      }

      // Make sure the container exists
      const container = document.getElementById(containerId);
      if (!container) {
        console.warn(`reCAPTCHA container #${containerId} not found in DOM`);
        throw new Error(
          `reCAPTCHA container #${containerId} not found. Please ensure the container exists in the DOM.`
        );
      }

      // Force clear any previous instances
      container.innerHTML = "";

      // Create a new reCAPTCHA verifier with more robust configuration
      recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
        size: invisible ? "invisible" : "normal",
        callback: () => {
          console.log("reCAPTCHA solved successfully");
        },
        "expired-callback": () => {
          console.log("reCAPTCHA expired, refreshing");
          if (recaptchaVerifier) {
            try {
              recaptchaVerifier.clear();
            } catch (e) {
              console.warn("Error clearing expired reCAPTCHA:", e);
            }
            this.initRecaptchaVerifier(containerId, invisible);
          }
        },
      });

      // Render the reCAPTCHA to ensure it's ready
      return recaptchaVerifier.render();
    } catch (error) {
      console.error("Error initializing reCAPTCHA:", error);
      throw error;
    }
  },

  /**
   * Send verification code to the selected phone number
   * @param {number} factorIndex - Index of the factor in the resolver hints array
   */
  async sendMfaSignInVerificationCode(factorIndex) {
    if (!resolver || !recaptchaVerifier) {
      throw new Error("MFA resolver or reCAPTCHA not initialized");
    }

    try {
      selectedIndex = factorIndex;
      const hint = resolver.hints[factorIndex];

      // Get the phone provider with the reCAPTCHA verifier
      const phoneAuthProvider = new PhoneAuthProvider(auth);

      // Send verification code
      const newVerificationId = await phoneAuthProvider.verifyPhoneNumber(
        { multiFactorHint: hint, session: resolver.session },
        recaptchaVerifier
      );

      // Store the verification ID for later use
      verificationId = newVerificationId;

      return verificationId;
    } catch (error) {
      console.error("Error sending verification code:", error);
      throw error;
    }
  },

  /**
   * Complete MFA sign-in with verification code
   * @param {string} verificationCode - Code received via SMS
   * @returns {UserCredential} User credential after successful verification
   */
  async completeMfaSignIn(verificationCode) {
    if (!verificationId) {
      throw new Error("No verification in progress");
    }

    try {
      // Create a phone credential with the code
      const credential = PhoneAuthProvider.credential(
        verificationId,
        verificationCode
      );

      // Complete sign-in with the credential
      const multiFactorAssertion =
        PhoneMultiFactorGenerator.assertion(credential);
      const userCredential = await resolver.resolveSignIn(multiFactorAssertion);

      // Clear state
      verificationId = null;
      selectedIndex = null;

      return userCredential;
    } catch (error) {
      console.error("Error completing MFA sign-in:", error);
      throw error;
    }
  },

  /**
   * Check if a user has MFA enrolled
   * @param {Object} user - Firebase user object
   * @returns {Object} Object with enrolled status and factors
   */
  checkMfaEnrollment(user) {
    if (!user) {
      return { enrolled: false, factors: [] };
    }

    try {
      const multiFactorUser = multiFactor(user);
      const enrolledFactors = multiFactorUser.enrolledFactors || [];

      return {
        enrolled: enrolledFactors.length > 0,
        factors: enrolledFactors,
      };
    } catch (error) {
      console.error("Error checking MFA enrollment:", error);
      return { enrolled: false, factors: [] };
    }
  },

  /**
   * Send verification code for MFA enrollment
   * @param {string} phoneNumber - Phone number to enroll
   * @returns {Promise<string>} Verification ID
   */
  async sendVerificationCodeForEnrollment(phoneNumber) {
    try {
      // Make sure reCAPTCHA is initialized
      if (
        !recaptchaVerifier ||
        !document.getElementById("recaptcha-container")
      ) {
        console.log("Initializing reCAPTCHA for verification");
        await this.initRecaptchaVerifier("recaptcha-container", true);
      }

      const user = auth.currentUser;
      if (!user) {
        throw new Error("No authenticated user");
      }

      // Format and validate the phone number
      const validPhoneNumber = validatePhoneNumber(phoneNumber);
      console.log(`Starting SMS verification process for: ${validPhoneNumber}`);

      // Get the multiFactor object for the user
      const multiFactorUser = multiFactor(user);

      // Create a PhoneAuthProvider
      const phoneAuthProvider = new PhoneAuthProvider(auth);

      // Make sure session is obtained correctly
      const session = await multiFactorUser.getSession();
      console.log("MFA session obtained successfully");

      // Send verification code - this will send a real SMS to the phone number
      console.log("Sending verification code via SMS...");
      verificationId = await phoneAuthProvider.verifyPhoneNumber(
        {
          phoneNumber: validPhoneNumber,
          session: session,
        },
        recaptchaVerifier
      );

      console.log("SMS verification initiated successfully");
      return verificationId;
    } catch (error) {
      console.error("Error sending verification code for enrollment:", error);

      // Provide more detailed error messages based on error code
      if (error.code === "auth/invalid-phone-number") {
        throw new Error(
          "Invalid phone number format. Please use international format with + (e.g., +12345678901)"
        );
      } else if (error.code === "auth/quota-exceeded") {
        throw new Error("SMS quota exceeded. Please try again tomorrow.");
      } else if (error.code === "auth/captcha-check-failed") {
        throw new Error(
          "reCAPTCHA validation failed. Please refresh the page and try again."
        );
      } else if (
        error.code === "auth/invalid-app-credential" ||
        error.code === "auth/missing-app-credential"
      ) {
        throw new Error(
          "Firebase Phone Auth is not properly configured. Please ensure your Firebase project has phone authentication enabled in the console and the reCAPTCHA API key is correct."
        );
      } else if (error.code === "auth/network-request-failed") {
        throw new Error(
          "Network error. Please check your internet connection and try again."
        );
      }

      // For other errors, throw a generic but helpful message
      throw new Error(
        `Error sending verification code: ${error.message || "Unknown error"}`
      );
    }
  },

  /**
   * Complete MFA enrollment with verification code
   * @param {string} verificationCode - Code received via SMS
   * @param {string} displayName - Display name for the phone factor
   * @returns {Promise<Object>} Enrollment result
   */
  async completeMfaEnrollment(verificationCode, displayName = "My Phone") {
    if (!verificationId) {
      throw new Error("No verification in progress");
    }

    const user = auth.currentUser;
    if (!user) {
      throw new Error("No authenticated user");
    }

    try {
      // Create credential with the verification code
      const phoneAuthCredential = PhoneAuthProvider.credential(
        verificationId,
        verificationCode
      );

      // Create the MFA assertion
      const multiFactorAssertion =
        PhoneMultiFactorGenerator.assertion(phoneAuthCredential);

      // Enroll the second factor with display name
      const multiFactorUser = multiFactor(user);
      await multiFactorUser.enroll(multiFactorAssertion, displayName);

      // Update user profile in Firestore to mark MFA as enabled
      await updateDoc(doc(db, "users", user.uid), {
        mfaEnabled: true,
        updatedAt: new Date(),
      });

      // Clear verification state
      verificationId = null;

      return { success: true };
    } catch (error) {
      console.error("Error completing MFA enrollment:", error);
      throw error;
    }
  },

  /**
   * Enroll a phone number as an MFA factor for a user account
   * @param {string} email - User's email (can be null if user is already signed in)
   * @param {string} password - User's password (can be null if user is already signed in)
   * @param {string} phoneNumber - Phone number to enroll (e.g., +15551234567)
   * @param {string} verificationCode - Code received via SMS (can be null if just sending the code)
   * @returns {Promise<void>}
   */
  async enrolWithPhoneNumber(email, password, phoneNumber, verificationCode) {
    try {
      // Make sure reCAPTCHA is initialized
      if (
        !recaptchaVerifier ||
        !document.getElementById("recaptcha-container")
      ) {
        await this.initRecaptchaVerifier("recaptcha-container", true);
      }

      let user = auth.currentUser;

      // If user is not already signed in, sign them in with email and password
      if (!user && email && password) {
        const userCredential = await signInWithEmailAndPassword(
          auth,
          email,
          password
        );
        user = userCredential.user;
      }

      // Ensure we have a user
      if (!user) {
        throw new Error("No authenticated user. Please sign in to enable MFA.");
      }

      // Format and validate phone number
      const validPhoneNumber = validatePhoneNumber(phoneNumber);

      // Get the multiFactor object for the user
      const multiFactorUser = multiFactor(user);

      // Create a PhoneAuthProvider
      const phoneAuthProvider = new PhoneAuthProvider(auth);

      // Send verification code if verificationId is not already set
      if (!verificationId) {
        verificationId = await phoneAuthProvider.verifyPhoneNumber(
          {
            phoneNumber: validPhoneNumber,
            session: await multiFactorUser.getSession(),
          },
          recaptchaVerifier
        );

        // If we're just sending the code (no verification code provided yet)
        if (!verificationCode) {
          return verificationId;
        }
      }

      // Create credential with the verification code
      const phoneAuthCredential = PhoneAuthProvider.credential(
        verificationId,
        verificationCode
      );

      // Create the MFA assertion
      const multiFactorAssertion =
        PhoneMultiFactorGenerator.assertion(phoneAuthCredential);

      // Enroll the second factor
      await multiFactorUser.enroll(multiFactorAssertion, validPhoneNumber);

      // Update user profile in Firestore to mark MFA as enabled
      await updateDoc(doc(db, "users", user.uid), {
        mfaEnabled: true,
        updatedAt: new Date(),
      });

      // Clear verification state
      verificationId = null;

      return { success: true };
    } catch (error) {
      console.error("Error enrolling phone for MFA:", error);

      // Provide specific error messages
      if (error.code === "auth/invalid-verification-code") {
        throw new Error("Invalid verification code. Please try again.");
      } else if (error.code === "auth/code-expired") {
        throw new Error(
          "Verification code has expired. Please request a new code."
        );
      }

      throw error;
    }
  },

  /**
   * Unenroll a phone number from MFA
   * @param {string} factorUid - UID of the MFA factor to unenroll
   * @returns {Promise<Object>} Result object
   */
  async unenrollFactor(factorUid) {
    const user = auth.currentUser;
    if (!user) {
      throw new Error("No authenticated user");
    }

    try {
      const multiFactorUser = multiFactor(user);
      const enrolledFactors = multiFactorUser.enrolledFactors || [];

      if (enrolledFactors.length === 0) {
        throw new Error("No factors are enrolled");
      }

      // Unenroll the factor by UID
      await multiFactorUser.unenroll({ uid: factorUid });

      // Update user profile in Firestore if no more factors are enrolled
      const remainingFactors = multiFactorUser.enrolledFactors || [];
      if (remainingFactors.length === 0) {
        await updateDoc(doc(db, "users", user.uid), {
          mfaEnabled: false,
          updatedAt: new Date(),
        });
      }

      return { success: true };
    } catch (error) {
      console.error("Error unenrolling MFA factor:", error);
      throw error;
    }
  },

  /**
   * Get the enrolled MFA factors for the current user
   * @returns {Promise<Array>} List of enrolled factors
   */
  async getEnrolledFactors() {
    const user = auth.currentUser;
    if (!user) {
      throw new Error("No authenticated user");
    }

    try {
      const multiFactorUser = multiFactor(user);
      return multiFactorUser.enrolledFactors || [];
    } catch (error) {
      console.error("Error getting enrolled factors:", error);
      throw error;
    }
  },
};

export default twoFactorAuthService;
export const { enrolWithPhoneNumber } = twoFactorAuthService;
