import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import AppRoutes from './routes/AppRoutes';
import Nav from './components/Navbar.jsx';
import Footer from './components/Footer';
import { UserProvider } from './context/UserContext';
import { ToastProvider } from './contexts/ToastContext';
import { ThemeProvider } from './context/ThemeContext';
import { NotificationProvider } from './contexts/NotificationContext';
import NotificationToastContainer from './components/NotificationToastContainer';
import './styles/App.css';
import './styles/Buttons.css'; // Importing common button styles

function App() {
  return (
    <ThemeProvider>
      <UserProvider>
        <ToastProvider>
          <NotificationProvider>
            <div className="app">
              <Nav />
              <NotificationToastContainer />
              <main className="main-content">
                <AppRoutes />
              </main>
              <Footer />
            </div>
          </NotificationProvider>
        </ToastProvider>
      </UserProvider>
    </ThemeProvider>
  );
}

export default App;
