import React, { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import "../styles/Navbar.css";
import { FiMenu, FiX } from "react-icons/fi";
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
  const menuRef = useRef(null);
  const location = useLocation();

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

  return (
    <>
      <nav className="navbar">
        <div className="navbar-container">
          <div className="logo">
            <Link to="/">
              <img src={Logo} alt="Portable Home logo" />
            </Link>
          </div>

          <ul className="quick-links-desktop-container">
            <div className="quick-links-desktop">
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
            </div>
          </ul>

          <ul ref={menuRef} className={`nav-links ${isOpen ? "active" : ""}`}>
            <li className="nav-item home-link">
              <Link to="/" className={isActive('/') ? 'active' : ''}>Home</Link>
            </li>
            <li className="nav-item shop-link">
              <Link to="/shop" className={isActive('/shop') ? 'active' : ''}>Shop</Link>
            </li>
            <li className="nav-item about-link">
              <Link to="/about" className={isActive('/about') ? 'active' : ''}>About</Link>
            </li>
            <li className="nav-item contact-link">
              <Link to="/contact" className={isActive('/contact') ? 'active' : ''}>Contact</Link>
            </li>

            <div className="quick-links">
              <li className="nav-item navbar-icons">
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
            </div>

            {user && AdminEmails.includes(user.email) ? (
              <>
                <li>
                  <Link to="/admin" className={isActive('/admin') ? 'active' : ''}>Admin</Link>
                </li>
                <li>
                  <button onClick={handleSignOut}>Sign Out</button>
                </li>
              </>
            ) : (
              <li>
                <Link to="/signin" className={isActive('/signin') ? 'active' : ''}>Sign In</Link>
              </li>
            )}
          </ul>

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
        </div>
      </nav>
      {isOpen && (
        <div className="overlay" onClick={() => setIsOpen(false)}></div>
      )}
    </>
  );
};

export default Navbar;
