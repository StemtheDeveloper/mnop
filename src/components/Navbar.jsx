import React, { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import "../styles/Navbar.css";
import Logo from "../assets/logos/Logo full black_1.svg";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "../config/firebase.js";
import Burger from "../assets/Burger 3@4x.png"
import CloseBurger from "../assets/Close-Burger@4x.png"
import MessageIcon from "../assets/message icon mini.png";
import NotificationsIcon from "../assets/Notification icon mini.png";
import CartIcon from "../assets/Shopping trolly drag edition.png";

const AdminEmails = [
  "stiaan44@gmail.com",
];

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 912);
  const menuRef = useRef(null);
  const location = useLocation();

  // Update isMobile state when window is resized
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 912);
      if (window.innerWidth > 912) {
        setIsOpen(false); // Close mobile menu when switching to desktop
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
    });
    return () => unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await signOut(auth);
  };

  // Function to check if a link is active
  const isActive = (path) => {
    if (path === '/' && location.pathname === '/') {
      return true;
    }
    return path !== '/' && location.pathname === path;
  };

  // Navigation links component that's used in both desktop and mobile
  const NavLinks = ({ isMobileMenu = false }) => (
    <>
      <li className="nav-item home-link">
        <Link to="/" className={isActive('/') ? 'active' : ''} onClick={() => isMobileMenu && setIsOpen(false)}>Home</Link>
      </li>
      <li className="nav-item shop-link">
        <Link to="/shop" className={isActive('/shop') ? 'active' : ''} onClick={() => isMobileMenu && setIsOpen(false)}>Shop</Link>
      </li>
      <li className="nav-item about-link">
        <Link to="/about" className={isActive('/about') ? 'active' : ''} onClick={() => isMobileMenu && setIsOpen(false)}>About</Link>
      </li>
      <li className="nav-item contact-link">
        <Link to="/contact" className={isActive('/contact') ? 'active' : ''} onClick={() => isMobileMenu && setIsOpen(false)}>Contact</Link>
      </li>
      <li className="nav-item profile-link">
        <Link to="/profile" className={isActive('/profile') ? 'active' : ''} onClick={() => isMobileMenu && setIsOpen(false)}>Profile</Link>
      </li>

      {user && AdminEmails.includes(user.email) && (
        <li className="nav-item admin-link">
          <Link to="/admin" className={isActive('/admin') ? 'active' : ''} onClick={() => isMobileMenu && setIsOpen(false)}>Admin</Link>
        </li>
      )}
    </>
  );

  return (
    <>
      <nav className="navbar">
        <div className="navbar-container">
          <div className="logo">
            <Link to="/">
              <img src={Logo} alt="Portable Home logo" />
            </Link>
          </div>

          {/* Desktop Navigation - only visible on larger screens */}
          <div className="desktop-nav">
            <ul className="nav-links-desktop">
              <NavLinks />
            </ul>

            <div className="quick-links">
              <ul><li className="nav-item navbar-icons">
                <Link to="/messages">
                  <img src={MessageIcon} alt="Message icon" />
                </Link>
              </li>
                <div className="c-h-r"></div>
                <li className="nav-item navbar-icons">
                  <Link to="/notifications">
                    <img src={NotificationsIcon} alt="Notifications icon" />
                  </Link>
                </li>
                <div className="c-h-r"></div>
                <li className="nav-item navbar-icons">
                  <Link to="/cart">
                    <img src={CartIcon} alt="Cart icon" />
                  </Link>
                </li>
              </ul>
              <div className="c-h-r"></div>
              {user && AdminEmails.includes(user.email) ? (
                <li className="nav-item">
                  <button onClick={handleSignOut} className="sign-out-btn">Sign Out</button>
                </li>
              ) : (
                <li className="nav-item">
                  <Link to="/signin" className={isActive('/signin') ? 'active' : ''}>Sign In</Link>
                </li>
              )}
            </div>
          </div>

          {/* Mobile Quick Links - always visible on mobile */}
          <ul className="quick-links-mobile">
            <li className="nav-item navbar-icons">
              <Link to="/messages">
                <img src={MessageIcon} alt="Message icon" />
              </Link>
            </li>
            <li className="nav-item navbar-icons">
              <Link to="/notifications">
                <img src={NotificationsIcon} alt="Notifications icon" />
              </Link>
            </li>
            <li className="nav-item navbar-icons">
              <Link to="/cart">
                <img src={CartIcon} alt="Cart icon" />
              </Link>
            </li>
          </ul>

          {/* Mobile Navigation Menu */}
          <div className="mobile-nav">
            {/* Burger Menu Icons */}
            <div className="menu-icons">
              <img
                id="burger-icon"
                className={`menu-icon ${isOpen ? "open" : ""}`}
                onClick={() => setIsOpen(true)}
                src={Burger}
                alt="A juicy looking burger icon"
              />
              <img
                id="close-burger-icon"
                className={`menu-icon ${isOpen ? "" : "open"}`}
                onClick={() => setIsOpen(false)}
                src={CloseBurger}
                alt="Two burger 3D burger patties arranged to form an X"
              />
            </div>

            {/* Mobile Menu */}
            <ul ref={menuRef} className={`nav-links-mobile ${isOpen ? "active" : ""}`}>
              <NavLinks isMobileMenu={true} />

              {user && AdminEmails.includes(user.email) ? (
                <li className="nav-item">
                  <button onClick={handleSignOut} className="sign-out-btn">Sign Out</button>
                </li>
              ) : (
                <li className="nav-item">
                  <Link to="/signin" className={isActive('/signin') ? 'active' : ''} onClick={() => setIsOpen(false)}>Sign In</Link>
                </li>
              )}
            </ul>
          </div>
        </div>
      </nav>
      {isOpen && (
        <div className="overlay" onClick={() => setIsOpen(false)}></div>
      )}
    </>
  );
};

export default Navbar;
