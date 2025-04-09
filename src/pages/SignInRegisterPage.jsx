import React, { useState } from 'react';
import { auth, db } from '../config/firebase';

function SignInRegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [role, setRole] = useState('designer');

  const handleSignIn = async (e) => {
    e.preventDefault();
    try {
      await auth.signInWithEmailAndPassword(email, password);
      // Redirect to home page or dashboard
    } catch (error) {
      console.error("Error signing in: ", error);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      const userCredential = await auth.createUserWithEmailAndPassword(email, password);
      const user = userCredential.user;
      await db.collection('users').doc(user.uid).set({
        email,
        role,
      });
      // Redirect to home page or dashboard
    } catch (error) {
      console.error("Error registering: ", error);
    }
  };

  return (
    <div>
      <h1>{isRegister ? 'Register' : 'Sign In'}</h1>
      <form onSubmit={isRegister ? handleRegister : handleSignIn}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
        />
        {isRegister && (
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="designer">Designer</option>
            <option value="manufacturer">Manufacturer</option>
            <option value="investor">Investor</option>
          </select>
        )}
        <button type="submit">{isRegister ? 'Register' : 'Sign In'}</button>
      </form>
      <button onClick={() => setIsRegister(!isRegister)}>
        {isRegister ? 'Already have an account? Sign In' : 'Don\'t have an account? Register'}
      </button>
    </div>
  );
}

export default SignInRegisterPage;
