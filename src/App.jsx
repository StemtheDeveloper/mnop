import React, { useEffect } from 'react';
import { BrowserRouter as Router, useLocation } from 'react-router-dom';
import AppRoutes from './routes/AppRoutes';
import Nav from './components/Navbar';
import Footer from './components/Footer';
import { UserProvider } from './context/UserContext';
import { ThemeProvider } from './context/ThemeContext';
import { CartProvider } from './context/CartContext';
import { AuthProvider, AuthConsumer } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { FeedbackProvider } from './context/FeedbackContext';
import { CurrencyProvider } from './context/CurrencyContext';
import NotificationToastContainer from './components/NotificationToastContainer';
import { NotificationRefresher } from './components/notifications';
import WrappedAdminProductNotifier from './components/admin/WrappedAdminProductNotifier';
import DebugComponent from './components/admin/DebugComponent';
import PolicyNotificationBanner from './components/PolicyNotificationBanner';
import CookieConsentBanner from './components/CookieConsentBanner';
import FeedbackBar from './components/FeedbackBar';
import ScrollToTop from './components/ScrollToTop'; // Import ScrollToTop component
import { ErrorBoundary } from './components/error';

// Importing common button styles

function App() {
  const location = useLocation();
  const isCookiesPage = location.pathname === '/cookies';

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <UserProvider>
          <AuthProvider>            <AuthConsumer>
            <NotificationProvider>
              <CurrencyProvider>
                <CartProvider>
                  <FeedbackProvider>
                    <ScrollToTop /> {/* Add ScrollToTop component here */}
                    <div className="app">
                      <br /><br /><br /><br /><br />
                      <Nav />
                      <NotificationToastContainer />
                      <NotificationRefresher />
                      <PolicyNotificationBanner />
                      {!isCookiesPage && <CookieConsentBanner />}
                      <DebugComponent />
                      {/* <WrappedAdminProductNotifier /> */}

                      <FeedbackBar />
                      <main className="main-content">
                        <ErrorBoundary>
                          <AppRoutes />
                        </ErrorBoundary>
                      </main>
                      <Footer />
                    </div>

                  </FeedbackProvider>
                </CartProvider>              </CurrencyProvider>
            </NotificationProvider>
          </AuthConsumer>
          </AuthProvider>
        </UserProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;