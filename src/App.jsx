import React, { Suspense, lazy } from 'react';
import { Route, Routes } from 'react-router-dom';
import { UserProvider } from './context/UserContext';
import Navbar from "./components/Navbar";
import './App.css';
import { USER_ROLES } from './context/UserContext';

// Import directly as these are small components needed immediately
import ProtectedRoute from './components/ProtectedRoute';
import AuthGuard from './components/AuthGuard';

// Lazy load page components
const LandingPage = lazy(() => import('./pages/LandingPage'));
const SignInRegisterPage = lazy(() => import('./pages/SignInRegisterPage'));
const HomeDashboardPage = lazy(() => import('./pages/HomeDashboardPage'));
const ShopPage = lazy(() => import('./pages/ShopPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
const ContactPage = lazy(() => import('./pages/ContactPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const CartPage = lazy(() => import('./pages/CartPage'));
const ProductsPage = lazy(() => import('./pages/ProductsPage'));
const CheckoutPage = lazy(() => import('./pages/CheckoutPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));
const UnauthorizedPage = lazy(() => import('./pages/UnauthorizedPage'));

// Loading fallback component
const LoadingFallback = () => (
  <div className="page-loading-fallback">
    <div className="loading-spinner-container">
      <div className="loading-spinner"></div>
    </div>
  </div>
);

function App() {
  return (
    <UserProvider>
      <div className="App">
        <Navbar />
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/signin" element={<SignInRegisterPage />} />
            <Route path="/register" element={<SignInRegisterPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/shop" element={<ShopPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/products" element={<ProductsPage />} />
            <Route path="/unauthorized" element={<UnauthorizedPage />} />

            {/* Authentication required routes */}
            <Route path="/cart" element={
              <ProtectedRoute>
                <CartPage />
              </ProtectedRoute>
            } />
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

            {/* Role-based routes */}
            <Route path="/admin" element={
              <AuthGuard allowedRoles={USER_ROLES.ADMIN}>
                <AdminPage />
              </AuthGuard>
            } />

            {/* 404 Not Found Route - must be last */}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </div>
    </UserProvider>
  );
}

export default App;
