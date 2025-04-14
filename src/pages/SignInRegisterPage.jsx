
import React, { useState } from "react";
import { signInWithEmailAndPassword, signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "../config/firebase.js";
import { useNavigate } from "react-router-dom";
import "../styles/SignIn.css";

const SignInRegisterPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

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
    <div className="page">
      <h2>Sign In</h2>
      <p>Create an email and password</p>
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
