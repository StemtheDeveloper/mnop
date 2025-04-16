import React, { useState, useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import AppRoutes from './routes/AppRoutes';
import Nav from './components/Navbar.jsx';
import Footer from './components/Footer';
import { UserProvider } from './context/UserContext';
import { ToastProvider } from './context/ToastContext';
import { ThemeProvider } from './context/ThemeContext';
import './styles/App.css';

function App() {
  return (

    <ThemeProvider>
      <ToastProvider>
        <UserProvider>
          <div className="app">
            <Nav />
            <main className="main-content">
              <AppRoutes />
            </main>
            <Footer />
          </div>
        </UserProvider>
      </ToastProvider>
    </ThemeProvider>

  );
}

export default App;
