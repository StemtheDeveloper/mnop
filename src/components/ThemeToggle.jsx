import React from 'react';
import { useTheme } from '../context/ThemeContext';


const ThemeToggle = () => {
    const { darkMode, toggleDarkMode } = useTheme();

    return (
        <div className="theme-toggle">
            <button
                onClick={toggleDarkMode}
                className="theme-toggle-button"
                aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
                title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
                {darkMode ? (
                    <span className="theme-icon light-icon">☀️</span>
                ) : (
                    <span className="theme-icon dark-icon">🌙</span>
                )}
            </button>
        </div>
    );
};

export default ThemeToggle;