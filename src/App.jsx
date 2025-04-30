import React from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import AppRoutes from './routes/AppRoutes';
import Nav from './components/Navbar.jsx';
import Footer from './components/Footer';
import { UserProvider } from './context/UserContext';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, AuthConsumer } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { ToastProvider } from './contexts/ToastContext';
import NotificationToastContainer from './components/NotificationToastContainer';
import NotificationRefresher from './components/NotificationRefresher';
import AdminProductNotifier from './components/admin/AdminProductNotifier';
import PolicyNotificationBanner from './components/PolicyNotificationBanner';
import './styles/App.css';
import './styles/Buttons.css'; // Importing common button styles

function App() {
  return (
    <ThemeProvider>
      <UserProvider>
        <AuthProvider>
          <AuthConsumer>
            <NotificationProvider>
              <ToastProvider>
                <div className="app">
                  <Nav />
                  <NotificationToastContainer />
                  <NotificationRefresher />
                  <AdminProductNotifier />
                  <PolicyNotificationBanner />
                  <main className="main-content">
                    <AppRoutes />
                  </main>
                  <Footer />
                </div>
              </ToastProvider>
            </NotificationProvider>
          </AuthConsumer>
        </AuthProvider>
      </UserProvider>
    </ThemeProvider>
  );
}

export default App;