import React, { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import "../styles/Navbar.css";
import Logo from "../assets/logos/Logo full black_1.svg";
import { onAuthStateChanged, signOut, getAuth } from "firebase/auth";
import { auth } from "../config/firebase.js";
import { useUser } from "../context/UserContext";
import Burger from "../assets/Burger 3@4x.png"
import CloseBurger from "../assets/Close-Burger@4x.png"
import MessageIcon from "../assets/message icon mini.png";
import NotificationsIcon from "../assets/Notification icon mini.png";
import CartIcon from "../assets/Shopping trolly drag edition.png";
import WalletIcon from "../assets/Wally_1@2x.png";
import NotificationCenter from "./NotificationCenter";
import notificationService from "../services/notificationService";
import AchievementBadgeDisplay from './AchievementBadgeDisplay';
import NotificationInbox from './NotificationInbox';
import { useToast } from '../context/ToastContext';

const AdminEmails = [
  "stiaan44@gmail.com",
];

const Navbar = () => {
  // Fix: properly destructure what's available from useUser()
  // Remove the problematic setCurrentUser from destructuring
  const { user, userProfile, userRole, loading, signOut: userSignOut } = useUser();
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [walletBalance, setWalletBalance] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 912);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const menuRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();
  const auth = getAuth();

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
  }, [isOpen]);

  // Fix: Update the onAuthStateChanged listener to use Firebase's auth directly
  // without trying to use setCurrentUser from context
  useEffect(() => {
    // Simply use onAuthStateChanged to monitor auth state changes
    // UserContext should have its own listener that handles this
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      // No need to call setCurrentUser here, the UserContext will handle this
    });

    return () => unsubscribe();
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      showSuccess('Successfully logged out');
      navigate('/login');
    } catch (error) {
      showError('Failed to log out');
      console.error('Logout error:', error);
    }
  };

  // Function to check if a link is active
  const isActive = (path) => {
    if (path === '/' && location.pathname === '/') {
      return true;
    }
    return path !== '/' && location.pathname === path;
  };

  // Detect if we're using mobile menu
  const isMobileMenu = isMobile || isOpen;

  // Load unread notification count
  useEffect(() => {
    const loadUnreadCount = async () => {
      if (!user?.uid) return;

      try {
        const response = await notificationService.getUnreadCount(user.uid);
        if (response.success) {
          setUnreadCount(response.data.count);
        }
      } catch (err) {
        console.error('Error loading unread notifications count:', err);
      }
    };

    if (user) {
      loadUnreadCount();

      // Set up interval to refresh count (every 60 seconds)
      const interval = setInterval(loadUnreadCount, 60000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const handleNotificationClick = () => {
    setNotificationsOpen(true);
  };

  const closeNotifications = () => {
    setNotificationsOpen(false);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      navigate(`/search?query=${encodeURIComponent(searchTerm.trim())}`);
    }
  };

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const renderUserMenu = () => {
    if (user) {
      return (
        <div className="dropdown-content">
          <div className="dropdown-user-info">
            <div className="dropdown-user-avatar">
              {userProfile?.photoURL ? (
                <img src={userProfile.photoURL} alt={userProfile.displayName} />
              ) : (
                <div className="default-avatar">{userProfile?.displayName?.charAt(0) || user.email.charAt(0)}</div>
              )}
            </div>
            <div className="dropdown-user-name">
              <p>{userProfile?.displayName || 'User'}</p>
              <AchievementBadgeDisplay userId={user.uid} showTitle={false} limit={3} />
            </div>
          </div>
          <Link to="/profile">Profile</Link>
          <Link to="/profile/achievements">Achievements</Link>
          <Link to="/orders">Orders</Link>
          <Link to="/settings">Account Settings</Link>
          <button onClick={handleSignOut}>Sign Out</button>
        </div>
      );
    }
    return null;
  };

  // Navigation links component that's used in both desktop and mobile
  const NavLinks = () => (
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
      <nav className="navbar bg-primary text-white py-4">
        <div className="navbar-container container mx-auto px-4 flex flex-wrap items-center justify-between">
          <div className="logo flex items-center space-x-2">
            <Link to="/">
              <img src={Logo} alt="Portable Home logo" />
            </Link>
          </div>

          {/* Search Bar */}
          <div className="order-3 md:order-2 w-full md:w-auto mt-4 md:mt-0 md:flex">
            <form onSubmit={handleSearch} className="flex">
              <input
                type="search"
                placeholder="Search products..."
                className="px-4 py-2 w-full md:w-64 text-black rounded-l focus:outline-none"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <button
                type="submit"
                className="bg-secondary text-white px-4 py-2 rounded-r hover:bg-opacity-90"
              >
                Search
              </button>
            </form>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={toggleMenu}
            className="order-2 md:hidden flex items-center text-white"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d={isMenuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"}
              ></path>
            </svg>
          </button>

          {/* Desktop Navigation - only visible on larger screens */}
          <div className="desktop-nav order-4 md:order-3 md:flex w-full md:w-auto mt-4 md:mt-0">
            <ul className="nav-links-desktop flex flex-row md:flex-row md:space-x-4 space-y-2 md:space-y-0">
              <NavLinks />
            </ul>

            <div className="quick-links flex flex-col md:flex-row md:space-x-4 space-y-2 md:space-y-0">
              <ul><li className="nav-item navbar-icons">
                <Link to="/messages">
                  <img src={MessageIcon} alt="Message icon" />
                </Link>
              </li>
                <div className="c-h-r"></div>
                <li className="nav-item navbar-icons">
                  <div className="icon-container" onClick={handleNotificationClick}>
                    <img src={NotificationsIcon} alt="Notifications" className="nav-icons" />
                    {unreadCount > 0 && (
                      <span className="notification-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
                    )}
                  </div>
                </li>
                <div className="c-h-r"></div>
                <li className="nav-item navbar-icons">
                  <Link to="/cart">
                    <img src={CartIcon} alt="Cart icon" />
                  </Link>
                </li>
                <div className="c-h-r"></div>
                <li className="nav-item navbar-icons wallet-icon-container">
                  <Link to="/wallet">
                    <img src={WalletIcon} alt="Wallet icon" />
                    {walletBalance !== null && (
                      <span className="wallet-balance-badge">
                        ${walletBalance.toFixed(0)}
                      </span>
                    )}
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
              <li className="nav-item">
                <Link to="/messages" className={isActive('/messages') ? 'active' : ''} onClick={() => setIsOpen(false)}>Messages</Link>
              </li>
              <li className="nav-item">
                <Link to="/notifications" className={isActive('/notifications') ? 'active' : ''} onClick={() => setIsOpen(false)}>Notifications</Link>
              </li>
              <li className="nav-item">
                <Link to="/wallet" className={isActive('/wallet') ? 'active' : ''} onClick={() => setIsOpen(false)}>
                  Wallet {walletBalance !== null && `($${walletBalance.toFixed(0)})`}
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </nav>
      {isOpen && (
        <div className="overlay" onClick={() => setIsOpen(false)}></div>
      )}
      {notificationsOpen && (
        <NotificationCenter isOpen={notificationsOpen} onClose={closeNotifications} />
      )}
      <NotificationInbox
        isOpen={notificationsOpen}
        onClose={closeNotifications}
      />
    </>
  );
};

export default Navbar;
