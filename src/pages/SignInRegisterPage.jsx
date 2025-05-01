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
import twoFactorAuthService from "../services/twoFactorAuthService";
import socialMediaService from "../services/socialMediaService";
import TwoFactorAuthVerification from "../components/TwoFactorAuthVerification";
import "../styles/SignIn.css";

const SignInRegisterPage = () => {
  // State for form fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [selectedRole, setSelectedRole] = useState(USER_ROLES.CUSTOMER);

  // State for UI management
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetRequested, setResetRequested] = useState(false);
  const [isRegisterMode, setIsRegisterMode] = useState(false);

  // Two-factor authentication state
  const [show2FAVerification, setShow2FAVerification] = useState(false);
  const [twoFactorSecret, setTwoFactorSecret] = useState('');
  const [pendingUserId, setPendingUserId] = useState('');
  const [pendingPhoneNumber, setPendingPhoneNumber] = useState('');

  const navigate = useNavigate();
  const location = useLocation();

  // Determine if we're in register mode based on URL path
  useEffect(() => {
    setIsRegisterMode(location.pathname === '/register');
    // Clear any previous messages when switching modes
    setError("");
    setSuccess("");
  }, [location.pathname]);

  // Get the previous location from state, or default to the home page
  const from = location?.state?.from || '/';
  const redirectMessage = location?.state?.message;

  // Form validation
  const validateForm = () => {
    // Reset previous errors
    setError("");

    // Basic validation
    if (!email.trim()) {
      setError("Email is required");
      return false;
    }
    if (!password) {
      setError("Password is required");
      return false;
    }

    // For registration, validate additional fields
    if (isRegisterMode) {
      if (password.length < 6) {
        setError("Password must be at least 6 characters");
        return false;
      }
      if (password !== confirmPassword) {
        setError("Passwords do not match");
        return false;
      }
      if (!displayName.trim()) {
        setError("Name is required");
        return false;
      }
    }

    return true;
  };

  // Handle sign in with email/password
  const handleSignIn = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    setError("");

    try {
      // Sign in with Firebase Authentication
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Check if user has 2FA enabled
      const twoFactorStatus = await twoFactorAuthService.get2FAStatus(user.uid);

      if (twoFactorStatus.success && twoFactorStatus.data.enabled) {
        // User has 2FA enabled, sign them out and show 2FA verification
        await auth.signOut();

        // Get the user document to retrieve the phone number
        const userDoc = await getDoc(doc(db, "users", user.uid));
        const userData = userDoc.data();

        if (userData && userData.twoFactorAuth && userData.twoFactorAuth.phoneNumber) {
          // Save user ID and phone number for verification
          setPendingUserId(user.uid);
          setPendingPhoneNumber(userData.twoFactorAuth.phoneNumber);
          setShow2FAVerification(true);
        } else {
          setError("Two-factor authentication is enabled but not properly configured. Please contact support.");
        }

        setLoading(false);
      } else {
        // User doesn't have 2FA enabled, proceed with login
        navigate(from);
      }
    } catch (err) {
      console.error("Sign in error:", err);
      setError(getAuthErrorMessage(err.code));
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
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Update profile with display name
      await updateProfile(user, { displayName });

      // Create a user document in Firestore with selected role
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        email: email,
        displayName: displayName,
        photoURL: user.photoURL || null,
        roles: [selectedRole], // Store roles as an array for future expansion
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

        // No need to check 2FA for new users
        navigate(from);
      } else {
        // For existing users, check if they have 2FA enabled
        const twoFactorStatus = await twoFactorAuthService.get2FAStatus(user.uid);

        if (twoFactorStatus.success && twoFactorStatus.data.enabled) {
          // User has 2FA enabled, sign them out and show 2FA verification
          await auth.signOut();

          // Get the user document to retrieve the phone number
          const userDoc = await getDoc(doc(db, "users", user.uid));
          const userData = userDoc.data();

          if (userData?.twoFactorAuth?.phoneNumber) {
            // Save user ID and phone number for verification
            setPendingUserId(user.uid);
            setPendingPhoneNumber(userData.twoFactorAuth.phoneNumber);
            setShow2FAVerification(true);
          } else {
            setError("Two-factor authentication is enabled but not properly configured. Please contact support.");
          }

          setLoading(false);
        } else {
          // Update last login time
          const userRef = doc(db, "users", user.uid);
          await setDoc(userRef, {
            lastLogin: serverTimestamp()
          }, { merge: true });

          // User doesn't have 2FA enabled, proceed with login
          navigate(from);
        }
      }
    } catch (err) {
      console.error("Google sign in error:", err);
      setError(getAuthErrorMessage(err.code));
      setLoading(false);
    }
  };

  // Handle Facebook sign in
  const handleFacebookSignIn = async () => {
    setLoading(true);
    setError("");

    try {
      const result = await socialMediaService.signInWithFacebook();

      if (!result.success) {
        throw new Error(result.error || "Facebook sign-in failed");
      }

      // Check for 2FA if needed (similar to Google sign-in flow)
      const user = result.user;
      const twoFactorStatus = await twoFactorAuthService.get2FAStatus(user.uid);

      if (twoFactorStatus.success && twoFactorStatus.data.enabled) {
        // Handle 2FA verification as with Google login
        await auth.signOut();
        const userDoc = await getDoc(doc(db, "users", user.uid));
        const userData = userDoc.data();

        if (userData?.twoFactorAuth?.phoneNumber) {
          setPendingUserId(user.uid);
          setPendingPhoneNumber(userData.twoFactorAuth.phoneNumber);
          setShow2FAVerification(true);
        } else {
          setError("Two-factor authentication is enabled but not properly configured.");
        }

        setLoading(false);
      } else {
        // Proceed with navigation
        navigate(from);
      }
    } catch (err) {
      console.error("Facebook sign in error:", err);
      setError(getAuthErrorMessage(err.code) || err.message);
      setLoading(false);
    }
  };

  // Handle Twitter sign in
  const handleTwitterSignIn = async () => {
    setLoading(true);
    setError("");

    try {
      const result = await socialMediaService.signInWithTwitter();

      if (!result.success) {
        throw new Error(result.error || "Twitter sign-in failed");
      }

      // Check for 2FA if needed (similar to Google sign-in flow)
      const user = result.user;
      const twoFactorStatus = await twoFactorAuthService.get2FAStatus(user.uid);

      if (twoFactorStatus.success && twoFactorStatus.data.enabled) {
        // Handle 2FA verification as with Google login
        await auth.signOut();
        const userDoc = await getDoc(doc(db, "users", user.uid));
        const userData = userDoc.data();

        if (userData?.twoFactorAuth?.phoneNumber) {
          setPendingUserId(user.uid);
          setPendingPhoneNumber(userData.twoFactorAuth.phoneNumber);
          setShow2FAVerification(true);
        } else {
          setError("Two-factor authentication is enabled but not properly configured.");
        }

        setLoading(false);
      } else {
        // Proceed with navigation
        navigate(from);
      }
    } catch (err) {
      console.error("Twitter sign in error:", err);
      setError(getAuthErrorMessage(err.code) || err.message);
      setLoading(false);
    }
  };

  // Handle password reset
  const handlePasswordReset = async (e) => {
    e.preventDefault();

    if (!email.trim()) {
      setError("Please enter your email address");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await sendPasswordResetEmail(auth, email);
      setSuccess("Password reset email sent! Check your inbox.");
      setResetRequested(false);
    } catch (err) {
      setError(getAuthErrorMessage(err.code));
    } finally {
      setLoading(false);
    }
  };

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

  // Handle successful 2FA verification
  const handle2FAVerificationSuccess = async () => {
    setLoading(true);

    try {
      // Re-sign in the user
      // For security reasons, we need to ask for their password again
      await signInWithEmailAndPassword(auth, email, password);

      // Update last login time
      const userRef = doc(db, "users", pendingUserId);
      await setDoc(userRef, {
        lastLogin: serverTimestamp()
      }, { merge: true });

      // Reset 2FA state
      setShow2FAVerification(false);
      setPendingUserId('');
      setPendingPhoneNumber('');

      // Redirect to the destination
      navigate(from);
    } catch (err) {
      console.error("Error after 2FA verification:", err);
      setError("Authentication failed after two-factor verification. Please try again.");
      setShow2FAVerification(false);
      setLoading(false);
    }
  };

  // Handle 2FA verification cancellation
  const handle2FAVerificationCancel = () => {
    setShow2FAVerification(false);
    setPendingUserId('');
    setPendingPhoneNumber('');
  };

  // Render password reset form
  if (resetRequested) {
    return (
      <div className="signin-register-container">
        <h1>Reset Your Password</h1>
        <p className="form-subtext">Enter your email address and we'll send you a link to reset your password.</p>

        {error && <div className="auth-error">{error}</div>}
        {success && <div className="auth-success">{success}</div>}

        <form onSubmit={handlePasswordReset} className="auth-form">
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Your email address"
              required
            />
          </div>

          <button
            type="submit"
            className="btn-primary"
            disabled={loading}
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

  // Render 2FA verification form
  if (show2FAVerification) {
    return (
      <div className="signin-register-container">
        <TwoFactorAuthVerification
          userId={pendingUserId}
          phoneNumber={pendingPhoneNumber}
          onVerificationSuccess={handle2FAVerificationSuccess}
          onCancel={handle2FAVerificationCancel}
        />
      </div>
    );
  }

  // Main signin/register form
  return (
    <div className="signin-register-container">
      <h1>{isRegisterMode ? 'Create an Account' : 'Sign In to Your Account'}</h1>

      {redirectMessage && (
        <div className="redirect-message">
          <p>{redirectMessage}</p>
          {from !== '/' && (
            <p className="redirect-path">
              You were trying to access: <strong>{from}</strong>
            </p>
          )}
        </div>
      )}

      {!redirectMessage && location.state?.from && (
        <div className="redirect-message">
          <p>Please sign in to continue</p>
          <p className="redirect-path">
            You were trying to access: <strong>{from}</strong>
          </p>
        </div>
      )}

      {error && <div className="auth-error">{error}</div>}
      {success && <div className="auth-success">{success}</div>}

      <form onSubmit={isRegisterMode ? handleRegister : handleSignIn} className="auth-form">
        {isRegisterMode && (
          <div className="form-group">
            <label htmlFor="displayName">Name</label>
            <input
              id="displayName"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your full name"
              required={isRegisterMode}
            />
          </div>
        )}

        <div className="form-group">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Your email address"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={isRegisterMode ? "Create a password" : "Your password"}
            required
          />
        </div>

        {isRegisterMode && (
          <>
            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm Password</label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your password"
                required={isRegisterMode}
              />
            </div>

            <div className="form-group">
              <label htmlFor="role">I am a:</label>
              <select
                id="role"
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="role-select"
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
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 48 48">
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
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
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
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
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
