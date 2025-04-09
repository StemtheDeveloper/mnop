import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import SignInRegisterPage from './pages/SignInRegisterPage';
import HomeDashboardPage from './pages/HomeDashboardPage';
import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/signin" element={<SignInRegisterPage />} />
          <Route path="/register" element={<SignInRegisterPage />} />
          <Route path="/home" element={<HomeDashboardPage />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
