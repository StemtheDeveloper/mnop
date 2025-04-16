import React, { createContext, useState, useContext, useEffect } from 'react';

const ThemeContext = createContext();

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({ children }) => {
    // Check local storage for saved preference, default to light mode
    const [darkMode, setDarkMode] = useState(() => {
        const savedTheme = localStorage.getItem('darkMode');
        return savedTheme ? JSON.parse(savedTheme) : false;
    });

    // Toggle dark mode
    const toggleDarkMode = () => {
        setDarkMode(prevMode => !prevMode);
    };

    // Apply dark mode class to body
    useEffect(() => {
        // Save preference to local storage
        localStorage.setItem('darkMode', JSON.stringify(darkMode));

        // Apply/remove dark-mode class on body
        if (darkMode) {
            document.body.classList.add('dark-mode');
        } else {
            document.body.classList.remove('dark-mode');
        }
    }, [darkMode]);

    return (
        <ThemeContext.Provider value={{ darkMode, toggleDarkMode }}>
            {children}
        </ThemeContext.Provider>
    );
};

export default ThemeContext;