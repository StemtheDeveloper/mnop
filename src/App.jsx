import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import AppRoutes from './routes/AppRoutes';
import Nav from './components/Navbar.jsx';
import Footer from './components/Footer';
import { UserProvider } from './context/UserContext';
import { ThemeProvider } from './context/ThemeContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { ToastProvider } from './contexts/ToastContext';
import NotificationToastContainer from './components/NotificationToastContainer';
import AdminProductNotifier from './components/admin/AdminProductNotifier';
import './styles/App.css';
import './styles/Buttons.css'; // Importing common button styles

function App() {
  return (
    <ThemeProvider>
      <UserProvider>
        <NotificationProvider>
          <ToastProvider>
            <div className="app">
              <br /><br /><br /><br /><br /><br /><br />
              <Nav />
              <NotificationToastContainer />
              <AdminProductNotifier />
              <main className="main-content">
                <AppRoutes />
              </main>
              <Footer />
            </div>
          </ToastProvider>
        </NotificationProvider>
      </UserProvider>
    </ThemeProvider>
  );
}

export default App;
