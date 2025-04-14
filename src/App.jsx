import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import SignInRegisterPage from './pages/SignInRegisterPage';
import HomeDashboardPage from './pages/HomeDashboardPage';
import ShopPage from './pages/ShopPage';
import AdminPage from './pages/AdminPage.jsx';
import AboutPage from './pages/AboutPage.jsx';
import ContactPage from './pages/ContactPage.jsx';
import Navbar from "./components/Navbar";




import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import reactLogo from './assets/react.svg'

import { CookiesProvider } from 'react-cookie';

import './App.css'


function App() {
  return (

    <div className="App">
      <Navbar></Navbar>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/signin" element={<SignInRegisterPage />} />
        <Route path="/register" element={<SignInRegisterPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/shop" element={<ShopPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/home" element={<HomeDashboardPage />} />
        <Route path="/admin" element={<AdminPage />} />
      </Routes>
    </div>

  );
}

export default App;
