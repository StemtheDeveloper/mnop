import React, { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import LoadingSpinner from '../components/LoadingSpinner';
import AuthGuard from '../components/AuthGuard';

// Lazy-loaded components
const LandingPage = lazy(() => import('../pages/LandingPage'));
const SignInRegisterPage = lazy(() => import('../pages/SignInRegisterPage'));
const HomeDashboardPage = lazy(() => import('../pages/HomeDashboardPage'));
const ShopPage = lazy(() => import('../pages/ShopPage'));
const SearchPage = lazy(() => import('../pages/SearchPage')); // Import SearchPage
const UserSearchPage = lazy(() => import('../pages/UserSearchPage')); // Import UserSearchPage
const ProductDetailPage = lazy(() => import('../pages/ProductDetailPage'));
const ProfilePage = lazy(() => import('../pages/ProfilePage'));
const UserProfilePage = lazy(() => import('../pages/UserProfilePage')); // Import the new UserProfilePage
const WalletPage = lazy(() => import('../pages/WalletPage'));
const AdminPage = lazy(() => import('../pages/AdminPage'));
const NotFoundPage = lazy(() => import('../pages/NotFoundPage'));
const UnauthorizedPage = lazy(() => import('../pages/UnauthorizedPage'));
const ProductsPage = lazy(() => import('../pages/ProductsPage'));
const OrdersPage = lazy(() => import('../pages/OrdersPage'));
const OrderDetailPage = lazy(() => import('../pages/OrderDetailPage'));
const CartPage = lazy(() => import('../pages/CartPage'));
const CheckoutPage = lazy(() => import('../pages/CheckoutPage'));
const ProductUploadPage = lazy(() => import('../pages/ProductUploadPage'));
const ProductEditPage = lazy(() => import('../pages/ProductEditPage'));
const AboutPage = lazy(() => import('../pages/AboutPage'));
const ContactPage = lazy(() => import('../pages/ContactPage'));
const AchievementsPage = lazy(() => import('../pages/AchievementsPage'));
const AchievementsBadgesPage = lazy(() => import('../pages/AchievementsBadgesPage'));
const DesignerQuotesPage = lazy(() => import('../pages/DesignerQuotesPage'));
const DesignerQuoteDetailPage = lazy(() => import('../pages/DesignerQuoteDetailPage'));
const HelpDocumentationPage = lazy(() => import('../pages/HelpDocumentationPage'));
const IdeaDetailPage = lazy(() => import('../pages/IdeaDetailPage'));
const IdeasPage = lazy(() => import('../pages/IdeasPage'));
const InvestmentPortfolioPage = lazy(() => import('../pages/InvestmentPortfolioPage'));
const ManufacturerQuotesPage = lazy(() => import('../pages/ManufacturerQuotesPage'));
const ManufacturerQuoteDetailPage = lazy(() => import('../pages/ManufacturerQuoteDetailPage'));
const ManufacturingManagementQuotesPage = lazy(() => import('../pages/ManufacturingManagementQuotesPage'));
const MessagesPage = lazy(() => import('../pages/MessagesPage'));
const ConversationPage = lazy(() => import('../pages/ConversationPage')); // Import ConversationPage instead
const NotificationsPage = lazy(() => import('../pages/NotificationsPage'));
const ToastDemoPage = lazy(() => import('../pages/ToastDemoPage'));
const UserSettingsPage = lazy(() => import('../pages/UserSettingsPage'));

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
                <Route path="/search" element={<SearchPage />} />
                <Route path="/users/search" element={<UserSearchPage />} />
                <Route path="/product/:productId" element={<ProductDetailPage />} />
                <Route path="/unauthorized" element={<UnauthorizedPage />} />
                <Route path="/cart" element={<CartPage />} />
                <Route path="/about" element={<AboutPage />} />
                <Route path="/contact" element={<ContactPage />} />
                <Route path="/help" element={<HelpDocumentationPage />} />
                <Route path="/ideas" element={<IdeasPage />} />
                <Route path="/idea/:ideaId" element={<IdeaDetailPage />} />

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
                <Route path="/user/:userId" element={<UserProfilePage />} />
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
                <Route path="/product-upload" element={
                    <AuthGuard allowedRoles={["designer"]}>
                        <ProductUploadPage />
                    </AuthGuard>
                } />
                <Route path="/product-edit/:productId" element={
                    <AuthGuard allowedRoles={["designer"]}>
                        <ProductEditPage />
                    </AuthGuard>
                } />
                <Route path="/settings" element={
                    <AuthGuard>
                        <UserSettingsPage />
                    </AuthGuard>
                } />
                <Route path="/achievements" element={
                    <AuthGuard>
                        <AchievementsPage />
                    </AuthGuard>
                } />
                <Route path="/achievements/badges" element={
                    <AuthGuard>
                        <AchievementsBadgesPage />
                    </AuthGuard>
                } />
                <Route path="/messages" element={
                    <AuthGuard>
                        <MessagesPage />
                    </AuthGuard>
                } />
                {/* Add route for individual conversation details */}
                <Route path="/messages/:conversationId" element={
                    <AuthGuard>
                        <ConversationPage />
                    </AuthGuard>
                } />
                <Route path="/notifications" element={
                    <AuthGuard>
                        <NotificationsPage />
                    </AuthGuard>
                } />
                <Route path="/portfolio" element={
                    <AuthGuard allowedRoles={["investor"]}>
                        <InvestmentPortfolioPage />
                    </AuthGuard>
                } />

                {/* Role-specific Routes */}
                <Route path="/designer/quotes" element={
                    <AuthGuard allowedRoles={["designer"]}>
                        <DesignerQuotesPage />
                    </AuthGuard>
                } />
                <Route path="/designer/quote/:quoteId" element={
                    <AuthGuard allowedRoles={["designer"]}>
                        <DesignerQuoteDetailPage />
                    </AuthGuard>
                } />
                <Route path="/manufacturer/quotes" element={
                    <AuthGuard allowedRoles={["manufacturer"]}>
                        <ManufacturerQuotesPage />
                    </AuthGuard>
                } />
                <Route path="/manufacturer/quote/:quoteId" element={
                    <AuthGuard allowedRoles={["manufacturer"]}>
                        <ManufacturerQuoteDetailPage />
                    </AuthGuard>
                } />
                <Route path="/manufacturing/quotes" element={
                    <AuthGuard allowedRoles={["manufacturer"]}>
                        <ManufacturingManagementQuotesPage />
                    </AuthGuard>
                } />

                {/* Development Routes */}
                <Route path="/toast-demo" element={<ToastDemoPage />} />

                {/* Admin Routes */}
                <Route path="/admin" element={
                    <AuthGuard allowedRoles="admin">
                        <AdminPage />
                    </AuthGuard>
                } />
                <Route path="/admin/achievements" element={
                    <AuthGuard allowedRoles="admin">
                        <AdminPage activeTab="achievements" />
                    </AuthGuard>
                } />

                {/* Fallback route - 404 */}
                <Route path="*" element={<NotFoundPage />} />
            </Routes>
        </Suspense>
    );
};

export default AppRoutes;
