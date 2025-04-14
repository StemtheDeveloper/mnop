import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { signInWithEmailAndPassword, signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "../config/firebase.js";
import "../styles/SignIn.css";

const SignInRegisterPage = () => {
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const auth = getAuth();

  // Get the previous location from state, or default to the home page
  const from = location.state?.from || '/';

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);

      // If user is authenticated, redirect them to the page they were trying to access
      if (currentUser) {
        navigate(from, { replace: true });
      }
    });

    return () => unsubscribe();
  }, [auth, navigate, from]);

  const handleSignIn = async (e) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate("/"); // Redirect to home page or any other page after successful sign-in
    } catch (err) {
      setError(err.message);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      navigate("/"); // Redirect to home page or any other page after successful sign-in
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="signin-register-container">
      <h1>{location.pathname === '/register' ? 'Create an Account' : 'Sign In'}</h1>

      {location.state?.from && (
        <p className="redirect-message">
          Please sign in to access {location.state.from}
        </p>
      )}

      {error && <p>{error}</p>}
      <form onSubmit={handleSignIn}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button id="signInBTN" type="submit">
          Sign In
        </button>
      </form>

      <h3>-------------- OR --------------</h3>
      <p>This is the recommended signin method</p>
      <button id="signInGoogle" onClick={handleGoogleSignIn}>
        Sign in with Google
      </button>
    </div>
  );
};

export default SignInRegisterPage;
