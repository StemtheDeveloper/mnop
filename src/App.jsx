import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import AppRoutes from './routes/AppRoutes';
import Nav from './components/Navbar.jsx';
import Footer from './components/Footer';
import { UserProvider } from './context/UserContext';
import { ThemeProvider } from './context/ThemeContext';
import { NotificationProvider } from './contexts/NotificationContext';
import NotificationToastContainer from './components/NotificationToastContainer';
import './styles/App.css';
import './styles/Buttons.css'; // Importing common button styles

function App() {
  return (
    <ThemeProvider>
      <UserProvider>
        <NotificationProvider>
          <div className="app">
            <br /><br /><br /><br /><br /><br /><br />
            <Nav />
            <NotificationToastContainer />
            <main className="main-content">
              <AppRoutes />
            </main>
            <Footer />
          </div>
        </NotificationProvider>
      </UserProvider>
    </ThemeProvider>
  );
}

export default App;
