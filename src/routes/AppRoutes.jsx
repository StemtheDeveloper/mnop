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
const ProductDetailPage = lazy(() => import('../pages/ProductDetailPage'));
const ProfilePage = lazy(() => import('../pages/ProfilePage'));
const UserProfilePage = lazy(() => import('../pages/UserProfilePage')); // Import the new UserProfilePage
const WalletPage = lazy(() => import('../pages/WalletPage'));
const EarningsPage = lazy(() => import('../pages/EarningsPage')); // Import EarningsPage
const ManufacturerDashboardPage = lazy(() => import('../pages/ManufacturerDashboardPage')); // Import ManufacturerDashboardPage
const AdminPage = lazy(() => import('../pages/AdminPage'));
const AdminDataFixerPage = lazy(() => import('../pages/AdminDataFixerPage'));
const AdminVerificationPage = lazy(() => import('../pages/AdminVerificationPage')); // Import verification page
const ReviewModerationPanel = lazy(() => import('../components/admin/ReviewModerationPanel')); // Import review moderation panel
const InventoryAlertsPanel = lazy(() => import('../components/admin/InventoryAlertsPanel')); // Import inventory alerts panel
const FeedbackAdminPage = lazy(() => import('../pages/FeedbackAdminPage')); // Import feedback admin page
const NotFoundPage = lazy(() => import('../pages/NotFoundPage'));
const UnauthorizedPage = lazy(() => import('../pages/UnauthorizedPage'));
const ProductsPage = lazy(() => import('../pages/ProductsPage'));
const OrdersPage = lazy(() => import('../pages/OrdersPage'));
const OrderDetailPage = lazy(() => import('../pages/OrderDetailPage'));
const CartPage = lazy(() => import('../pages/CartPage'));
const CheckoutPage = lazy(() => import('../pages/CheckoutPage'));
const ProductUploadPage = lazy(() => import('../pages/ProductUploadPage'));
const BulkProductUploaderPage = lazy(() => import('../pages/BulkProductUploaderPage')); // Import bulk product uploader
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
const ProductsCsvExportPage = lazy(() => import('../pages/ProductsCsvExportPage'));
const ProductsCsvImportPage = lazy(() => import('../pages/ProductsCsvImportPage'));
const TermsAndConditionsPage = lazy(() => import('../pages/TermsAndConditionsPage'));
const PrivacyPolicyPage = lazy(() => import('../pages/PrivacyPolicyPage'));
const ContentPolicyPage = lazy(() => import('../pages/ContentPolicyPage'));
const CookieManagementPage = lazy(() => import('../pages/CookieManagementPage')); // Import CookieManagementPage
const WishlistPage = lazy(() => import('../pages/WishlistPage')); // Import WishlistPage
const MfaSetupPage = lazy(() => import('../pages/MfaSetupPage')); // Import MFA Setup Page
const RegisterInvestorPage = lazy(() => import('../pages/RegisterInvestorPage')); // Import RegisterInvestorPage
const RegisterDesignerPage = lazy(() => import('../pages/RegisterDesignerPage')); // Import RegisterDesignerPage
const RegisterManufacturerPage = lazy(() => import('../pages/RegisterManufacturerPage')); // Import RegisterManufacturerPage
const VerificationRequestPage = lazy(() => import('../pages/VerificationRequestPage')); // Import VerificationRequestPage
const RoleRegistrationPage = lazy(() => import('../pages/RoleRegistrationPage')); // Import RoleRegistrationPage

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
                <Route path="/product/:productId" element={<ProductDetailPage />} />
                <Route path="/unauthorized" element={<UnauthorizedPage />} />
                <Route path="/cart" element={<CartPage />} />
                <Route path="/about" element={<AboutPage />} />
                <Route path="/contact" element={<ContactPage />} />
                <Route path="/help" element={<HelpDocumentationPage />} />
                <Route path="/ideas" element={<IdeasPage />} />
                <Route path="/idea/:ideaId" element={<IdeaDetailPage />} />

                {/* Policy Pages */}
                <Route path="/terms-and-conditions" element={<TermsAndConditionsPage />} />
                <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
                <Route path="/content-policy" element={<ContentPolicyPage />} />
                <Route path="/cookies" element={<CookieManagementPage />} />

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
                <Route path="/earnings" element={
                    <AuthGuard>
                        <EarningsPage />
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
                    <AuthGuard allowedRoles={["designer", "admin"]}>
                        <ProductUploadPage />
                    </AuthGuard>
                } />
                <Route path="/bulk-product-upload" element={
                    <AuthGuard allowedRoles={["designer", "admin"]}>
                        <BulkProductUploaderPage />
                    </AuthGuard>
                } />
                <Route path="/product-edit/:productId" element={
                    <AuthGuard allowedRoles={["designer", "admin"]}>
                        <ProductEditPage />
                    </AuthGuard>
                } />
                <Route path="/achievements" element={
                    <AuthGuard>
                        <AchievementsPage />
                    </AuthGuard>
                } />
                <Route path="/profile/:userId/achievements" element={
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
                <Route path="/wishlist" element={
                    <AuthGuard>
                        <WishlistPage />
                    </AuthGuard>
                } />
                <Route path="/portfolio" element={
                    <AuthGuard allowedRoles={["investor"]}>
                        <InvestmentPortfolioPage />
                    </AuthGuard>
                } />
                <Route path="/mfa-setup" element={
                    <AuthGuard>
                        <MfaSetupPage />
                    </AuthGuard>
                } />
                <Route path="/register-investor" element={
                    <AuthGuard>
                        <RegisterInvestorPage />
                    </AuthGuard>
                } />
                <Route path="/investor-registration" element={
                    <AuthGuard>
                        <RegisterInvestorPage />
                    </AuthGuard>
                } />
                <Route path="/register-designer" element={
                    <AuthGuard>
                        <RegisterDesignerPage />
                    </AuthGuard>
                } />
                <Route path="/register-manufacturer" element={
                    <AuthGuard>
                        <RegisterManufacturerPage />
                    </AuthGuard>
                } />
                <Route path="/role-registration/:role" element={
                    <AuthGuard>
                        <RoleRegistrationPage />
                    </AuthGuard>
                } />
                <Route path="/verification-request/:role" element={
                    <AuthGuard>
                        <VerificationRequestPage />
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
                <Route path="/manufacturer/dashboard" element={
                    <AuthGuard allowedRoles={["manufacturer"]}>
                        <ManufacturerDashboardPage />
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
                <Route path="/admin/data-fixer" element={
                    <AuthGuard allowedRoles="admin">
                        <AdminDataFixerPage />
                    </AuthGuard>
                } />
                <Route path="/admin/verify/:userId/:role" element={
                    <AuthGuard allowedRoles="admin">
                        <AdminVerificationPage />
                    </AuthGuard>
                } />
                <Route path="/admin/products-csv-export" element={
                    <AuthGuard allowedRoles="admin">
                        <ProductsCsvExportPage />
                    </AuthGuard>
                } />
                <Route path="/admin/products-csv-import" element={
                    <AuthGuard allowedRoles="admin">
                        <ProductsCsvImportPage />
                    </AuthGuard>
                } />
                <Route path="/admin/review-moderation" element={
                    <AuthGuard allowedRoles="admin">
                        <ReviewModerationPanel />
                    </AuthGuard>
                } />
                <Route path="/admin/inventory-alerts" element={
                    <AuthGuard allowedRoles="admin">
                        <InventoryAlertsPanel />
                    </AuthGuard>
                } />
                <Route path="/admin/feedback" element={
                    <AuthGuard allowedRoles="admin">
                        <FeedbackAdminPage />
                    </AuthGuard>
                } />
                <Route path="/admin/verification-requests" element={
                    <AuthGuard allowedRoles="admin">
                        <VerificationRequestPage />
                    </AuthGuard>
                } />

                {/* Fallback route - 404 */}
                <Route path="*" element={<NotFoundPage />} />
            </Routes>
        </Suspense>
    );
};

export default AppRoutes;