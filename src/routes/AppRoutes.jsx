import React, { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import LoadingSpinner from '../components/LoadingSpinner';
import AuthGuard from '../components/AuthGuard';

// Lazy-loaded components
const LandingPage = lazy(() => import('../pages/LandingPage'));
const SignInRegisterPage = lazy(() => import('../pages/SignInRegisterPage'));
const HomeDashboardPage = lazy(() => import('../pages/HomeDashboardPage'));
const ShopPage = lazy(() => import('../pages/ShopPage'));
const ProductDetailPage = lazy(() => import('../pages/ProductDetailPage'));
const ProfilePage = lazy(() => import('../pages/ProfilePage'));
const WalletPage = lazy(() => import('../pages/WalletPage'));
const AdminPage = lazy(() => import('../pages/AdminPage'));
const NotFoundPage = lazy(() => import('../pages/NotFoundPage'));
const UnauthorizedPage = lazy(() => import('../pages/UnauthorizedPage'));
const ProductsPage = lazy(() => import('../pages/ProductsPage'));
const OrdersPage = lazy(() => import('../pages/OrdersPage'));
const OrderDetailPage = lazy(() => import('../pages/OrderDetailPage'));
const CartPage = lazy(() => import('../pages/CartPage'));
const CheckoutPage = lazy(() => import('../pages/CheckoutPage'));

// Loading fallback
const LoadingFallback = () => (
    <div className="loading-container">
        <LoadingSpinner />
        <p>Loading page...</p>
    </div>
);

const AppRoutes = () => {
    return (
        <Suspense fallback={<LoadingFallback />}>
            <Routes>
                {/* Public Routes */}
                <Route path="/" element={<LandingPage />} />
                <Route path="/signin" element={<SignInRegisterPage />} />
                <Route path="/register" element={<SignInRegisterPage />} />
                <Route path="/shop" element={<ShopPage />} />
                <Route path="/product/:productId" element={<ProductDetailPage />} />
                <Route path="/unauthorized" element={<UnauthorizedPage />} />
                <Route path="/cart" element={<CartPage />} />

                {/* Protected Routes */}
                <Route path="/home" element={
                    <AuthGuard>
                        <HomeDashboardPage />
                    </AuthGuard>
                } />
                <Route path="/profile" element={
                    <AuthGuard>
                        <ProfilePage />
                    </AuthGuard>
                } />
                <Route path="/profile/:id" element={<ProfilePage />} />
                <Route path="/wallet" element={
                    <AuthGuard>
                        <WalletPage />
                    </AuthGuard>
                } />
                <Route path="/orders" element={
                    <AuthGuard>
                        <OrdersPage />
                    </AuthGuard>
                } />
                <Route path="/order/:orderId" element={
                    <AuthGuard>
                        <OrderDetailPage />
                    </AuthGuard>
                } />
                <Route path="/checkout" element={
                    <AuthGuard>
                        <CheckoutPage />
                    </AuthGuard>
                } />
                <Route path="/products" element={<ProductsPage />} />

                {/* Admin Routes */}
                <Route path="/admin" element={
                    <AuthGuard allowedRoles="admin">
                        <AdminPage />
                    </AuthGuard>
                } />

                {/* Fallback route - 404 */}
                <Route path="*" element={<NotFoundPage />} />
            </Routes>
        </Suspense>
    );
};

export default AppRoutes;
