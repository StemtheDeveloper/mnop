import React, { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import "../styles/Navbar.css";
import LogoBlack from "../assets/logos/Logo full black_1.svg";
import LogoWhite from "../assets/logos/Logo full white.svg";
import { auth } from "../config/firebase.js";
import { useUser } from "../context/UserContext";
import { useCart } from "../context/CartContext";
import { useTheme } from "../context/ThemeContext";
import Burger from "../assets/Burger 3@4x.png"
import CloseBurger from "../assets/Close-Burger@4x.png"
import MessageIcon from "../assets/Message@4x.png";
import NotificationsIcon from "../assets/Bell@4x.png";
import CartIcon from "../assets/Shopping trolly drag edition@4x.png";
import WishlistIcon from "../assets/Heart mini.png";
import WalletIcon from "../assets/Wally no legs big eyes@4x.webp";
import AchievementBadgeDisplay from './AchievementBadgeDisplay';
import ThemeToggle from './ThemeToggle';
import CurrencySelector from './CurrencySelector';
import EnhancedSearchInput from './EnhancedSearchInput';
import { useToast } from '../context/ToastContext';
import { useNotifications } from '../context/NotificationContext';
import { NotificationDrawer } from './notifications';

const AdminEmails = [
  "stiaan44@gmail.com",
];

const Navbar = () => {
  const { user, userProfile, userRole, loading, signOut: userSignOut, getWalletBalance } = useUser();
  const { cartCount } = useCart();
  const { darkMode } = useTheme(); // Get darkMode state from ThemeContext
  const [isOpen, setIsOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [walletBalance, setWalletBalance] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 912);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const menuRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();
  const { unreadCount, refresh: refreshNotifications } = useNotifications();

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 912);
      if (window.innerWidth > 912) {
        setIsOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Handle clicks outside menu
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Refresh notifications when component mounts
  useEffect(() => {
    if (user) {
      refreshNotifications();
    }
  }, [user, refreshNotifications]);

  // Load wallet balance when user changes
  useEffect(() => {
    const loadWalletBalance = async () => {
      if (user) {
        try {
          const balance = await getWalletBalance();
          setWalletBalance(balance);
        } catch (err) {
          console.error('Error loading wallet balance:', err);
        }
      } else {
        setWalletBalance(null);
      }
    };

    loadWalletBalance();
  }, [user, getWalletBalance]);

  // Handle sign out
  const handleSignOut = async () => {
    try {
      const result = await userSignOut();
      if (result.success) {
        showSuccess('Successfully logged out');
        navigate('/');
      } else {
        showError('Failed to log out');
      }
    } catch (error) {
      console.error('Logout error:', error);
      showError('Failed to log out');
    }
  };

  const isActive = (path) => {
    if (path === '/' && location.pathname === '/') {
      return true;
    }
    return path !== '/' && location.pathname === path;
  };

  const isMobileMenu = isMobile || isOpen;

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
          <Link to="/wishlist">Wishlist</Link>
          <Link to="/settings">Account Settings</Link>
          <button onClick={handleSignOut}>Sign Out</button>
        </div>
      );
    }
    return null;
  };

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
      <nav className="navbar">
        <div className="navbar-container">
          <div className="logo">
            <Link to="/">
              <img src={darkMode ? LogoWhite : LogoBlack} alt="Portable Home logo" />
            </Link>
          </div>

          <div className="mobile-nav">
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
                <Link to="/wallet">
                  <img src={WalletIcon} alt="Wallet icon" title="Wallet" style={{ width: 40 }} />
                </Link>
              </li>
              <li className="nav-item">
                <Link to="/wishlist" className={isActive('/wishlist') ? 'active' : ''} onClick={() => setIsOpen(false)}>Wishlist</Link>
              </li>
              <li className="nav-item">
                <Link to="/notifications" className={isActive('/notifications') ? 'active' : ''} onClick={() => setIsOpen(false)}>
                  <div className="notification-indicator">
                    Notifications
                    {unreadCount > 0 && <span className="notification-badge">{unreadCount}</span>}
                  </div>
                </Link>
              </li>
              <li className="nav-item">
                <Link to="/cart" className={isActive('/cart') ? 'active' : ''} onClick={() => setIsOpen(false)}>
                  Cart
                  {cartCount > 0 && (
                    <span className="notification-badge cart-badge">{cartCount > 99 ? '99+' : cartCount}</span>
                  )}
                </Link>
              </li>
              <li className="nav-item currency-selector-container">
                <div className="currency-selector-label">Currency</div>
                <CurrencySelector compact={true} />
              </li>
              <li className="nav-item theme-toggle-container">
                <div className="theme-toggle-label">Theme Mode</div>
                <ThemeToggle />
              </li>
            </ul>
          </div>

          <ul className="quick-links-mobile">
            <li className="nav-item navbar-icons">
              <Link to="/messages">
                <img src={MessageIcon} alt="Message icon" />
              </Link>
            </li>
            <li className="nav-item navbar-icons">
              <Link to="/wishlist">
                <img src={WishlistIcon} alt="Wishlist icon" />
              </Link>
            </li>
            <li className="nav-item navbar-icons">
              <div className="icon-container" onClick={handleNotificationClick}>
                <img src={NotificationsIcon} alt="Notifications icon" />
                {user && unreadCount > 0 && (
                  <span className="notification-badge" id="quick-links-notifications-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
                )}
              </div>
            </li>
            <li className="nav-item navbar-icons">
              <Link to="/cart">
                <img src={CartIcon} alt="Cart icon" />
                {cartCount > 0 && (
                  <span className="notification-badge cart-badge">{cartCount > 99 ? '99+' : cartCount}</span>
                )}
              </Link>
            </li>
          </ul>

          <div className="search-container">
            <EnhancedSearchInput />
          </div>

          <div className="desktop-nav">
            <ul className="nav-links-desktop">
              <NavLinks />
            </ul>

            <div className="quick-links">
              <ul className="icon-links">
                <li className="nav-item navbar-icons">
                  <Link to="/messages">
                    <img src={MessageIcon} alt="Message icon" title="Messages" />
                  </Link>
                </li>
                <div className="c-h-r"></div>
                <li className="nav-item navbar-icons">
                  <Link to="/wishlist">
                    <img src={WishlistIcon} alt="Wishlist icon" title="Wishlist" />
                  </Link>
                </li>
                <div className="c-h-r"></div>
                <li className="nav-item navbar-icons">
                  <div className="icon-container" onClick={handleNotificationClick}>
                    <img src={NotificationsIcon} alt="Notifications" title="Notifications" className="nav-icons" />
                    {user && unreadCount > 0 && (
                      <span className="notification-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
                    )}
                  </div>
                </li>
                <div className="c-h-r"></div>
                <li className="nav-item navbar-icons">
                  <Link to="/cart">
                    <img src={CartIcon} title="Cart" alt="Cart icon" />
                    {cartCount > 0 && (
                      <span className="notification-badge cart-badge">{cartCount > 99 ? '99+' : cartCount}</span>
                    )}
                  </Link>
                </li>
                <div className="c-h-r"></div>
                <li className="nav-item navbar-icons wallet-icon-container">
                  <Link to="/wallet">
                    <img src={WalletIcon} alt="Wallet icon" title="Wallet" style={{ width: 40 }} />
                  </Link>
                </li>
              </ul>
              <div className="c-h-r"></div>
              <div className="auth-actions">
                {user ? (
                  <li className="nav-item">
                    <button onClick={handleSignOut} className="sign-out-btn">Sign Out</button>
                  </li>
                ) : (
                  <li className="nav-item">
                    <Link to="/signin" className={isActive('/signin') ? 'active' : ''}>Sign In</Link>
                  </li>
                )}
                <CurrencySelector compact={true} />
                <ThemeToggle />
              </div>
            </div>
          </div>
        </div>
      </nav>
      {isOpen && (
        <div className="overlay" onClick={() => setIsOpen(false)}></div>
      )}
      {notificationsOpen && (
        <NotificationDrawer isOpen={notificationsOpen} onClose={closeNotifications} />
      )}

    </>
  );
};

export default Navbar;