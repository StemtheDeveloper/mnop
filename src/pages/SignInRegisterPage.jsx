import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  sendPasswordResetEmail,
  updateProfile
} from "firebase/auth";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { auth, db, googleProvider } from "../config/firebase.js";
import { USER_ROLES } from "../context/UserContext";
import socialMediaService from "../services/socialMediaService";
import MfaVerification from "../components/MfaVerification";
import FormInput from "../components/FormInput";
import { validators, FormValidator } from "../utils/FormValidation";
import "../styles/SignIn.css";
import "../styles/FormInput.css";

const SignInRegisterPage = () => {
  // Form validation state
  const [formValues, setFormValues] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    displayName: "",
    selectedRole: USER_ROLES.CUSTOMER
  });

  const [formErrors, setFormErrors] = useState({});
  const [touchedFields, setTouchedFields] = useState({});

  // State for UI management
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetRequested, setResetRequested] = useState(false);
  const [isRegisterMode, setIsRegisterMode] = useState(false);

  // State for MFA handling
  const [mfaError, setMfaError] = useState(null);
  const [showMfaVerification, setShowMfaVerification] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  // Determine if we're in register mode based on URL path
  useEffect(() => {
    setIsRegisterMode(location.pathname === '/register');
    // Clear any previous messages when switching modes
    setError("");
    setSuccess("");
    // Reset touched fields when switching modes
    setTouchedFields({});
  }, [location.pathname]);

  // Get the previous location from state, or default to the home page
  const from = location?.state?.from || '/';
  const redirectMessage = location?.state?.message;

  // Update form values when input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormValues({
      ...formValues,
      [name]: value
    });

    // Validate the field if it's been touched
    if (touchedFields[name]) {
      validateField(name, value);
    }
  };

  // Mark field as touched on blur and validate
  const handleInputBlur = (e) => {
    const { name, value } = e.target;
    setTouchedFields({
      ...touchedFields,
      [name]: true
    });

    validateField(name, value);
  };

  // Validate a single field
  const validateField = (name, value) => {
    let error = null;

    switch (name) {
      case 'email':
        error = validators.email(value);
        break;
      case 'password':
        error = validators.password(value);
        break;
      case 'confirmPassword':
        error = validators.confirmPassword(value, { password: formValues.password });
        break;
      case 'displayName':
        error = validators.required(value, { fieldName: 'Name' });
        break;
      default:
        break;
    }

    setFormErrors(prevErrors => ({
      ...prevErrors,
      [name]: error
    }));

    return !error;
  };

  // Validate all form fields
  const validateForm = () => {
    // Validate all fields based on current mode
    const fieldsToValidate = ['email', 'password'];
    if (isRegisterMode) {
      fieldsToValidate.push('confirmPassword', 'displayName');
    }

    // Mark all relevant fields as touched
    const newTouched = fieldsToValidate.reduce((acc, field) => {
      acc[field] = true;
      return acc;
    }, {});

    setTouchedFields(newTouched);

    // Validate each field
    const newErrors = {};
    let isValid = true;

    fieldsToValidate.forEach(field => {
      const valid = validateField(field, formValues[field]);
      if (!valid) isValid = false;
    });

    return isValid;
  };

  // Handle sign in with email/password
  const handleSignIn = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    setError("");
    setMfaError(null);

    try {
      // Sign in with Firebase Authentication
      const userCredential = await signInWithEmailAndPassword(auth, formValues.email, formValues.password);

      // Proceed with login
      navigate(from);
    } catch (err) {
      console.error("Sign in error:", err);

      // Handle MFA challenge
      if (err.code === 'auth/multi-factor-required') {
        // Set the MFA error to be handled by MfaVerification component
        setMfaError(err);
        setShowMfaVerification(true);
      } else {
        setError(getAuthErrorMessage(err.code));
      }
      setLoading(false);
    }
  };

  // Handle user registration with email/password
  const handleRegister = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    setError("");

    try {
      // Create user with email and password
      const userCredential = await createUserWithEmailAndPassword(auth, formValues.email, formValues.password);
      const user = userCredential.user;

      // Update profile with display name
      await updateProfile(user, { displayName: formValues.displayName });

      // Create a user document in Firestore with selected role
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        email: formValues.email,
        displayName: formValues.displayName,
        photoURL: user.photoURL || null,
        roles: [formValues.selectedRole], // Store roles as an array for future expansion
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      setSuccess("Account created successfully!");
      // Redirect will happen automatically
      navigate(from);
    } catch (err) {
      console.error("Registration error:", err);
      setError(getAuthErrorMessage(err.code));
      setLoading(false);
    }
  };

  // Handle Google sign in
  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError("");
    setMfaError(null);

    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      // Check if this is a new user
      const isNewUser = result._tokenResponse?.isNewUser;

      if (isNewUser) {
        // Create a user document in Firestore for new Google sign-ins
        await setDoc(doc(db, "users", user.uid), {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || "Google User",
          photoURL: user.photoURL || null,
          roles: [USER_ROLES.CUSTOMER], // Default role for Google sign-ins
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      } else {
        // Update last login time
        const userRef = doc(db, "users", user.uid);
        await setDoc(userRef, {
          lastLogin: serverTimestamp()
        }, { merge: true });
      }

      // Navigate to destination
      navigate(from);
    } catch (err) {
      console.error("Google sign in error:", err);

      // Handle MFA challenge
      if (err.code === 'auth/multi-factor-required' || err.code === 'auth/multi-factor-auth-required') {
        setMfaError(err);
        setShowMfaVerification(true);
      } else {
        setError(getAuthErrorMessage(err.code));
        setLoading(false);
      }
    }
  };

  // Handle Facebook sign in
  const handleFacebookSignIn = async () => {
    setLoading(true);
    setError("");
    setMfaError(null);

    try {
      const result = await socialMediaService.signInWithFacebook();

      if (!result.success) {
        throw new Error(result.error || "Facebook sign-in failed");
      }

      // Update login time and navigate
      navigate(from);
    } catch (err) {
      console.error("Facebook sign in error:", err);

      // Handle MFA challenge
      if (err.code === 'auth/multi-factor-required' || err.code === 'auth/multi-factor-auth-required') {
        setMfaError(err);
        setShowMfaVerification(true);
      } else {
        setError(getAuthErrorMessage(err.code) || err.message);
        setLoading(false);
      }
    }
  };

  // Handle Twitter sign in
  const handleTwitterSignIn = async () => {
    setLoading(true);
    setError("");
    setMfaError(null);

    try {
      const result = await socialMediaService.signInWithTwitter();

      if (!result.success) {
        throw new Error(result.error || "Twitter sign-in failed");
      }

      // Navigate to destination
      navigate(from);
    } catch (err) {
      console.error("Twitter sign in error:", err);

      // Handle MFA challenge
      if (err.code === 'auth/multi-factor-required' || err.code === 'auth/multi-factor-auth-required') {
        setMfaError(err);
        setShowMfaVerification(true);
      } else {
        setError(getAuthErrorMessage(err.code) || err.message);
        setLoading(false);
      }
    }
  };

  // Handle password reset
  const handlePasswordReset = async (e) => {
    e.preventDefault();

    // Validate email
    setTouchedFields({
      ...touchedFields,
      email: true
    });

    if (!validateField('email', formValues.email)) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      await sendPasswordResetEmail(auth, formValues.email);
      setSuccess("Password reset email sent! Check your inbox.");
      setResetRequested(false);
    } catch (err) {
      setError(getAuthErrorMessage(err.code));
    } finally {
      setLoading(false);
    }
  };

  // Handle successful MFA verification
  const handleMfaSuccess = (userCredential) => {
    setShowMfaVerification(false);
    setMfaError(null);
    setSuccess("Successfully signed in!");
    navigate(from);
  };

  // Handle MFA verification cancellation
  const handleMfaCancel = () => {
    setShowMfaVerification(false);
    setMfaError(null);
  };

  // Render MFA verification if needed
  if (showMfaVerification && mfaError) {
    return (
      <div className="signin-register-container">
        <MfaVerification
          error={mfaError}
          onSuccess={handleMfaSuccess}
          onCancel={handleMfaCancel}
        />
      </div>
    );
  }

  // Helper function to transform Firebase error codes into user-friendly messages
  const getAuthErrorMessage = (errorCode) => {
    switch (errorCode) {
      case 'auth/invalid-email':
        return 'Invalid email address';
      case 'auth/user-disabled':
        return 'This account has been disabled';
      case 'auth/user-not-found':
        return 'No account found with this email';
      case 'auth/wrong-password':
        return 'Incorrect password';
      case 'auth/email-already-in-use':
        return 'This email is already registered';
      case 'auth/weak-password':
        return 'Password should be at least 6 characters';
      case 'auth/popup-closed-by-user':
        return 'Sign-in canceled. The popup was closed.';
      case 'auth/operation-not-allowed':
        return 'This sign-in method is not enabled';
      case 'auth/network-request-failed':
        return 'Network error. Check your connection and try again.';
      case 'auth/too-many-requests':
        return 'Too many unsuccessful attempts. Try again later.';
      default:
        return 'An error occurred during authentication';
    }
  };

  // Render password reset form
  if (resetRequested) {
    return (
      <div className="signin-register-container">
        <h1>Reset Your Password</h1>
        <p className="form-subtext">Enter your email address and we'll send you a link to reset your password.</p>

        {error && <div className="auth-error" role="alert">{error}</div>}
        {success && <div className="auth-success" role="alert">{success}</div>}

        <form onSubmit={handlePasswordReset} className="auth-form">
          <FormInput
            id="reset-email"
            name="email"
            label="Email"
            type="email"
            value={formValues.email}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            error={touchedFields.email ? formErrors.email : null}
            placeholder="Your email address"
            required
            ariaProps={{
              'aria-required': 'true'
            }}
          />

          <button
            type="submit"
            className="btn-primary"
            disabled={loading}
            aria-busy={loading ? 'true' : 'false'}
          >
            {loading ? 'Sending...' : 'Send Reset Link'}
          </button>

          <button
            type="button"
            className="btn-text"
            onClick={() => setResetRequested(false)}
            disabled={loading}
          >
            Back to Sign In
          </button>
        </form>
      </div>
    );
  }

  // Main signin/register form
  return (
    <div className="signin-register-container">
      <br /><br /><br /><br /><br />
      <h1>{isRegisterMode ? 'Create an Account' : 'Sign In to Your Account'}</h1>

      {redirectMessage && (
        <div className="redirect-message" role="status">
          <p>{redirectMessage}</p>
          {from !== '/' && (
            <p className="redirect-path">
              You were trying to access: <strong>{from}</strong>
            </p>
          )}
        </div>
      )}

      {!redirectMessage && location.state?.from && (
        <div className="redirect-message" role="status">
          <p>Please sign in to continue</p>
          <p className="redirect-path">
            You were trying to access: <strong>{from}</strong>
          </p>
        </div>
      )}

      {error && <div className="auth-error" role="alert">{error}</div>}
      {success && <div className="auth-success" role="alert">{success}</div>}

      <form
        onSubmit={isRegisterMode ? handleRegister : handleSignIn}
        className="auth-form"
        noValidate
        aria-labelledby={isRegisterMode ? "register-heading" : "signin-heading"}
      >
        {isRegisterMode && (
          <FormInput
            id="displayName"
            name="displayName"
            label="Name"
            type="text"
            value={formValues.displayName}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            error={touchedFields.displayName ? formErrors.displayName : null}
            placeholder="Your full name"
            required
            ariaProps={{
              'aria-required': 'true'
            }}
          />
        )}

        <FormInput
          id="email"
          name="email"
          label="Email"
          type="email"
          value={formValues.email}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          error={touchedFields.email ? formErrors.email : null}
          placeholder="Your email address"
          required
          ariaProps={{
            'aria-required': 'true'
          }}
        />

        <FormInput
          id="password"
          name="password"
          label="Password"
          type="password"
          value={formValues.password}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          error={touchedFields.password ? formErrors.password : null}
          placeholder={isRegisterMode ? "Create a password" : "Your password"}
          required
          ariaProps={{
            'aria-required': 'true'
          }}
        />

        {isRegisterMode && (
          <>
            <FormInput
              id="confirmPassword"
              name="confirmPassword"
              label="Confirm Password"
              type="password"
              value={formValues.confirmPassword}
              onChange={handleInputChange}
              onBlur={handleInputBlur}
              error={touchedFields.confirmPassword ? formErrors.confirmPassword : null}
              placeholder="Confirm your password"
              required
              ariaProps={{
                'aria-required': 'true'
              }}
            />

            <div className="form-group">
              <label htmlFor="role" className="form-label">I am a:</label>
              <select
                id="role"
                name="selectedRole"
                value={formValues.selectedRole}
                onChange={handleInputChange}
                className="role-select form-control"
                aria-label="Select your role"
              >
                <option value={USER_ROLES.CUSTOMER}>Customer</option>
                <option value={USER_ROLES.DESIGNER}>Designer</option>
                <option value={USER_ROLES.MANUFACTURER}>Manufacturer</option>
                <option value={USER_ROLES.INVESTOR}>Investor</option>
              </select>
            </div>
          </>
        )}

        <button
          type="submit"
          className="btn-primary"
          disabled={loading}
          aria-busy={loading ? 'true' : 'false'}
        >
          {loading ? (isRegisterMode ? 'Creating Account...' : 'Signing In...') :
            (isRegisterMode ? 'Create Account' : 'Sign In')}
        </button>
      </form>

      {!isRegisterMode && (
        <button
          type="button"
          className="btn-text forgot-password"
          onClick={() => setResetRequested(true)}
          disabled={loading}
        >
          Forgot your password?
        </button>
      )}

      <div className="auth-divider">
        <span>OR</span>
      </div>

      <button
        type="button"
        onClick={handleGoogleSignIn}
        className="btn-google"
        disabled={loading}
        aria-busy={loading ? 'true' : 'false'}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
          <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z" />
          <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z" />
          <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z" />
          <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z" />
        </svg>
        {loading ? 'Processing...' : 'Continue with Google'}
      </button>

      <button
        type="button"
        onClick={handleFacebookSignIn}
        className="btn-facebook"
        disabled={loading}
        aria-label="Sign in with Facebook"
        aria-busy={loading ? 'true' : 'false'}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
          <path d="M12 2.04C6.5 2.04 2 6.53 2 12.06c0 5.1 3.75 9.35 8.68 10.12v-7.15H7.9v-2.97h2.78V9.85c0-2.75 1.64-4.27 4.15-4.27.82 0 1.73.1 2.55.2v2.86h-1.45c-1.36 0-1.73.65-1.73 1.54v1.86h2.97l-.45 2.97h-2.52v7.15c4.92-.77 8.68-5.02 8.68-10.12 0-5.53-4.5-10.02-10-10.02z" />
        </svg>
        {loading ? 'Processing...' : 'Continue with Facebook'}
      </button>

      <button
        type="button"
        onClick={handleTwitterSignIn}
        className="btn-twitter"
        disabled={loading}
        aria-label="Sign in with Twitter"
        aria-busy={loading ? 'true' : 'false'}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
          <path d="M22.46 6c-.77.35-1.6.58-2.46.69.88-.53 1.56-1.37 1.88-2.38-.83.5-1.75.85-2.72 1.05C18.37 4.5 17.26 4 16 4c-2.35 0-4.27 1.92-4.27 4.29 0 .34.04.67.11.98C8.28 9.09 5.11 7.38 3 4.79c-.37.63-.58 1.37-.58 2.15 0 1.49.75 2.81 1.91 3.56-.71 0-1.37-.2-1.95-.5v.03c0 2.08 1.48 3.82 3.44 4.21a4.22 4.22 0 0 1-1.93.07 4.28 4.28 0 0 0 4 2.98 8.521 8.521 0 0 1-5.33 1.84c-.34 0-.68-.02-1.02-.06C3.44 20.29 5.7 21 8.12 21 16 21 20.33 14.46 20.33 8.79c0-.19 0-.37-.01-.56.84-.6 1.56-1.36 2.14-2.23z" />
        </svg>
        {loading ? 'Processing...' : 'Continue with Twitter'}
      </button>

      <div className="auth-switch">
        {isRegisterMode ? (
          <>Already have an account? <Link to="/signin">Sign In</Link></>
        ) : (
          <>Don't have an account? <Link to="/register">Create Account</Link></>
        )}
      </div>
    </div>
  );
};

export default SignInRegisterPage;
