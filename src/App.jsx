import React from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import AppRoutes from './routes/AppRoutes';
import Nav from './components/Navbar';
import Footer from './components/Footer';
import { UserProvider } from './context/UserContext';
import { ThemeProvider } from './context/ThemeContext';
import { CartProvider } from './context/CartContext';
import { AuthProvider, AuthConsumer } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { ToastProvider } from './contexts/ToastContext';
import { FeedbackProvider } from './contexts/FeedbackContext.jsx';
import { CurrencyProvider } from './context/CurrencyContext';
import NotificationToastContainer from './components/NotificationToastContainer';
import { NotificationRefresher } from './components/notifications';
import AdminProductNotifier from './components/admin/AdminProductNotifier';
import PolicyNotificationBanner from './components/PolicyNotificationBanner';
import CookieConsentBanner from './components/CookieConsentBanner';
import FeedbackBar from './components/FeedbackBar';
import { ErrorBoundary } from './components/error';
import './styles/App.css';
import './styles/Buttons.css'; // Importing common button styles

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <UserProvider>
          <AuthProvider>
            <AuthConsumer>
              <NotificationProvider>
                <ToastProvider>
                  <CurrencyProvider>
                    <CartProvider>
                      <FeedbackProvider>
                        <div className="app">
                          <br /><br /><br /><br /><br />
                          <Nav />
                          <NotificationToastContainer />
                          <NotificationRefresher />
                          <AdminProductNotifier />
                          <PolicyNotificationBanner />
                          <CookieConsentBanner />

                          <FeedbackBar />
                          <main className="main-content">
                            <ErrorBoundary>
                              <AppRoutes />
                            </ErrorBoundary>
                          </main>
                          <Footer />
                        </div>
                      </FeedbackProvider>
                    </CartProvider>
                  </CurrencyProvider>
                </ToastProvider>
              </NotificationProvider>
            </AuthConsumer>
          </AuthProvider>
        </UserProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;