import React, { Suspense, lazy } from 'react';
import { Route, Routes, BrowserRouter as Router } from 'react-router-dom';
import { UserProvider } from './context/UserContext';
import { ToastProvider } from './context/ToastContext';
import Navbar from "./components/Navbar";
import './App.css';
import { USER_ROLES } from './context/UserContext';

// Import directly as these are small components needed immediately
import ProtectedRoute from './components/ProtectedRoute';
import AuthGuard from './components/AuthGuard';

// Lazy load all page components
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
const ProductDetailPage = lazy(() => import('./pages/ProductDetailPage'));
const OrdersPage = lazy(() => import('./pages/OrdersPage'));
const MessagesPage = lazy(() => import('./pages/MessagesPage'));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'));
const ProductUploadPage = lazy(() => import('./pages/ProductUploadPage'));
const WalletPage = lazy(() => import('./pages/WalletPage')); // Add import for WalletPage
const OrderDetailPage = lazy(() => import('./pages/OrderDetailPage')); // Add import for OrderDetailPage
import UserSettingsPage from './pages/UserSettingsPage';
import ToastDemoPage from './pages/ToastDemoPage';
import DesignerQuotesPage from './pages/DesignerQuotesPage';
import DesignerQuoteDetailPage from './pages/DesignerQuoteDetailPage';
import AchievementsPage from './pages/AchievementsPage'; // Add import for AchievementsPage

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
    <Router>
      <UserProvider>
        <ToastProvider>
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
                <Route path="/product/:id" element={<ProductDetailPage />} />
                <Route path="/unauthorized" element={<UnauthorizedPage />} />
                <Route path="/toast-demo" element={<ToastDemoPage />} />

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
                <Route path="/orders" element={
                  <ProtectedRoute>
                    <OrdersPage />
                  </ProtectedRoute>
                } />
                <Route path="/orders/:orderId" element={
                  <ProtectedRoute>
                    <OrderDetailPage />
                  </ProtectedRoute>
                } />
                <Route path="/messages" element={
                  <ProtectedRoute>
                    <MessagesPage />
                  </ProtectedRoute>
                } />
                <Route path="/notifications" element={
                  <ProtectedRoute>
                    <NotificationsPage />
                  </ProtectedRoute>
                } />
                <Route path="/checkout" element={
                  <ProtectedRoute>
                    <CheckoutPage />
                  </ProtectedRoute>
                } />
                <Route path="/wallet" element={
                  <ProtectedRoute>
                    <WalletPage />
                  </ProtectedRoute>
                } />
                <Route path="/settings" element={
                  <ProtectedRoute>
                    <UserSettingsPage />
                  </ProtectedRoute>
                } />

                {/* Achievement routes */}
                <Route path="/profile/achievements" element={
                  <ProtectedRoute>
                    <AchievementsPage />
                  </ProtectedRoute>
                } />
                <Route path="/profile/:userId/achievements" element={<AchievementsPage />} />

                {/* Role-based routes */}
                <Route path="/admin" element={
                  <AuthGuard allowedRoles={USER_ROLES.ADMIN}>
                    <AdminPage />
                  </AuthGuard>
                } />
                <Route path="/upload-product" element={
                  <AuthGuard allowedRoles={USER_ROLES.DESIGNER}>
                    <ProductUploadPage />
                  </AuthGuard>
                } />
                <Route path="/designer/quotes" element={
                  <ProtectedRoute requiredRoles="designer">
                    <DesignerQuotesPage />
                  </ProtectedRoute>
                } />
                <Route path="/designer/quotes/:quoteId" element={
                  <ProtectedRoute requiredRoles="designer">
                    <DesignerQuoteDetailPage />
                  </ProtectedRoute>
                } />

                {/* 404 Not Found Route - must be last */}
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </Suspense>
          </div>
        </ToastProvider>
      </UserProvider>
    </Router>
  );
}

export default App;
