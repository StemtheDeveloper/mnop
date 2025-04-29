import React, { createContext, useContext, useState } from 'react';

// Define toast severity levels
export const TOAST_SEVERITY = {
    SUCCESS: 'success',
    ERROR: 'error',
    WARNING: 'warning',
    INFO: 'info'
};

// Create the context
const ToastContext = createContext();

// Hook for easy context consumption
export const useToast = () => useContext(ToastContext);

// Helper to generate a unique ID
const generateUniqueId = () => {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// Provider component
export const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);

    // Function to show a success toast
    const showSuccess = (message, duration = 3000) => {
        const toast = {
            id: generateUniqueId(),
            message,
            severity: TOAST_SEVERITY.SUCCESS,
            duration
        };
        setToasts(prev => [...prev, toast]);
    };

    // Function to show an error toast
    const showError = (message, duration = 3000) => {
        const toast = {
            id: generateUniqueId(),
            message,
            severity: TOAST_SEVERITY.ERROR,
            duration
        };
        setToasts(prev => [...prev, toast]);
    };

    // Function to show a warning toast
    const showWarning = (message, duration = 3000) => {
        const toast = {
            id: generateUniqueId(),
            message,
            severity: TOAST_SEVERITY.WARNING,
            duration
        };
        setToasts(prev => [...prev, toast]);
    };

    // Function to show an info toast
    const showInfo = (message, duration = 3000) => {
        const toast = {
            id: generateUniqueId(),
            message,
            severity: TOAST_SEVERITY.INFO,
            duration
        };
        setToasts(prev => [...prev, toast]);
    };

    // Function to remove a toast
    const removeToast = (id) => {
        setToasts(prev => prev.filter(toast => toast.id !== id));
    };

    // Context value
    const value = {
        toasts,
        showSuccess,
        showError,
        showWarning,
        showInfo,
        removeToast
    };

    return (
        <ToastContext.Provider value={value}>
            {children}
            {/* Render toasts here or in a separate component */}
        </ToastContext.Provider>
    );
};
