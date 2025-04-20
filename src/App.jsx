import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import AppRoutes from './routes/AppRoutes';
import Nav from './components/Navbar.jsx';
import Footer from './components/Footer';
import { UserProvider } from './context/UserContext';
import { ToastProvider } from './context/ToastContext';
import { ThemeProvider } from './context/ThemeContext';
import { NotificationProvider, NotificationToastContainer } from './components/notifications/NotificationSystem';
import './styles/App.css';
import './styles/Buttons.css'; // Importing common button styles

function App() {
  return (
    <Router>
      <ThemeProvider>
        <NotificationProvider>
          <ToastProvider>
            <UserProvider>
              <div className="app">
                <Nav />
                <NotificationToastContainer />
                <main className="main-content">
                  <AppRoutes />
                </main>
                <Footer />
              </div>
            </UserProvider>
          </ToastProvider>
        </NotificationProvider>
      </ThemeProvider>
    </Router>
  );
}

export default App;
