import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import SignInRegisterPage from './pages/SignInRegisterPage';
import HomeDashboardPage from './pages/HomeDashboardPage';
import ShopPage from './pages/ShopPage';
import AdminPage from './pages/AdminPage.jsx';
import AboutPage from './pages/AboutPage.jsx';
import ContactPage from './pages/ContactPage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';
import CartPage from './pages/CartPage.jsx';
import ProductsPage from './pages/ProductsPage.jsx';
import CheckoutPage from './pages/CheckoutPage.jsx';
import Navbar from "./components/Navbar";
import ProtectedRoute from './components/ProtectedRoute';
import { UserProvider } from './context/UserContext';

import { CookiesProvider } from 'react-cookie';
import './App.css';

function App() {
  return (
    <UserProvider>
      <div className="App">
        <Navbar />
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/signin" element={<SignInRegisterPage />} />
          <Route path="/register" element={<SignInRegisterPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/shop" element={<ShopPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/cart" element={<CartPage />} />

          {/* Protected routes */}
          <Route path="/profile" element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          } />
          <Route path="/home" element={
            <ProtectedRoute>
              <HomeDashboardPage />
            </ProtectedRoute>
          } />
          <Route path="/checkout" element={
            <ProtectedRoute>
              <CheckoutPage />
            </ProtectedRoute>
          } />
          <Route path="/admin" element={
            <ProtectedRoute>
              <AdminPage />
            </ProtectedRoute>
          } />
          <Route path="/products" element={<ProductsPage />} />
        </Routes>
      </div>
    </UserProvider>
  );
}

export default App;
