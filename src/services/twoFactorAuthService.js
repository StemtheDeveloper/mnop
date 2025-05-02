import { auth } from "../config/firebase";
import {
  PhoneAuthProvider,
  PhoneMultiFactorGenerator,
  RecaptchaVerifier,
  multiFactor,
  signInWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../config/firebase";

// Store the current MFA session and resolver globally
let resolver = null;
let recaptchaVerifier = null;
let selectedIndex = null;
let verificationId = null;

/**
 * Service for handling two-factor authentication with Firebase
 * Supports MFA enrollment and verification
 */
const twoFactorAuthService = {
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
        recaptchaVerifier.clear();
      }

      // Create a new reCAPTCHA verifier
      recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
        size: invisible ? "invisible" : "normal",
        callback: () => {
          // reCAPTCHA solved, allow the user to continue
        },
        "expired-callback": () => {
          // Reset the reCAPTCHA
          if (recaptchaVerifier) {
            recaptchaVerifier.clear();
            this.initRecaptchaVerifier(containerId, invisible);
          }
        },
      });

      return recaptchaVerifier;
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
    if (!recaptchaVerifier) {
      throw new Error("reCAPTCHA not initialized");
    }

    const user = auth.currentUser;
    if (!user) {
      throw new Error("No authenticated user");
    }

    try {
      // Get the multiFactor object for the user
      const multiFactorUser = multiFactor(user);

      // Create a PhoneAuthProvider
      const phoneAuthProvider = new PhoneAuthProvider(auth);

      // Send verification code
      verificationId = await phoneAuthProvider.verifyPhoneNumber(
        {
          phoneNumber,
          session: await multiFactorUser.getSession(),
        },
        recaptchaVerifier
      );

      return verificationId;
    } catch (error) {
      console.error("Error sending verification code for enrollment:", error);
      throw error;
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
    // Make sure reCAPTCHA is initialized
    if (!recaptchaVerifier) {
      this.initRecaptchaVerifier("recaptcha-container", true);
    }

    try {
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

      // Get the multiFactor object for the user
      const multiFactorUser = multiFactor(user);

      // Create a PhoneAuthProvider
      const phoneAuthProvider = new PhoneAuthProvider(auth);

      // Send verification code if verificationId is not already set
      if (!verificationId) {
        verificationId = await phoneAuthProvider.verifyPhoneNumber(
          {
            phoneNumber,
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
      await multiFactorUser.enroll(multiFactorAssertion, phoneNumber);

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
