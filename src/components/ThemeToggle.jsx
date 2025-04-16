import React from 'react';
import { useTheme } from '../context/ThemeContext';
import '../styles/ThemeToggle.css';

const ThemeToggle = () => {
    const { darkMode, toggleDarkMode } = useTheme();

    return (
        <div className="theme-toggle">
            <button
                onClick={toggleDarkMode}
                className={`theme-toggle-button ${darkMode ? 'dark' : 'light'}`}
                aria-label={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
                {darkMode ? (
                    <span className="toggle-icon">☀️</span>
                ) : (
                    <span className="toggle-icon">🌙</span>
                )}
            </button>
        </div>
    );
};

export default ThemeToggle;