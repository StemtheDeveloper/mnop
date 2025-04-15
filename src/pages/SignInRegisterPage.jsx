import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import {
  getAuth,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  sendPasswordResetEmail
} from "firebase/auth";
import { doc, setDoc, getFirestore } from "firebase/firestore";
import { auth, googleProvider } from "../config/firebase.js";
import "../styles/SignIn.css";

const SignInRegisterPage = () => {
  // State for both sign in and registration
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetRequested, setResetRequested] = useState(false);
  const [isRegisterMode, setIsRegisterMode] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const auth = getAuth();
  const db = getFirestore();

  // Determine if we're in register mode based on URL path
  useEffect(() => {
    setIsRegisterMode(location.pathname === '/register');
    // Clear any previous errors when switching modes
    setError("");
    setSuccess("");
  }, [location.pathname]);

  // Get the previous location from state, or default to the home page
  const from = location.state?.from || '/';
  const redirectMessage = location.state?.message;

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);

      // If user is authenticated, redirect them to the page they were trying to access
      if (currentUser) {
        // Don't use replace: true here to allow back button to work
        navigate(from);
      }
    });

    return () => unsubscribe();
  }, [auth, navigate, from]);

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

  const handleSignIn = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    setError("");

    try {
      await signInWithEmailAndPassword(auth, email, password);
      // Redirect handled by onAuthStateChanged
    } catch (err) {
      console.error("Sign in error:", err);
      setError(getAuthErrorMessage(err.code));
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    setError("");

    try {
      // Create user with email and password
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Create a user document in Firestore
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        email: email,
        displayName: displayName,
        createdAt: new Date(),
        role: "customer" // Default role
      });

      setSuccess("Account created successfully!");
      // Redirect will be handled by onAuthStateChanged
    } catch (err) {
      console.error("Registration error:", err);
      setError(getAuthErrorMessage(err.code));
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError("");

    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      // Check if this is a new user or existing user
      // If the user was just created, isNewUser will be true
      const isNewUser = result._tokenResponse?.isNewUser;

      if (isNewUser) {
        // Create a user document in Firestore for new Google sign-ins
        await setDoc(doc(db, "users", user.uid), {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || "Google User",
          photoURL: user.photoURL,
          createdAt: new Date(),
          role: "customer" // Default role
        });
      }

      // Redirect handled by onAuthStateChanged
    } catch (err) {
      console.error("Google sign in error:", err);
      setError(getAuthErrorMessage(err.code));
      setLoading(false);
    }
  };

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
              placeholder="Your name"
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
