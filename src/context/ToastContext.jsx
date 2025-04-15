import React, { createContext, useState, useContext, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';

// Create the context
const ToastContext = createContext();

// Toast severity levels
export const TOAST_SEVERITY = {
    SUCCESS: 'success',
    ERROR: 'error',
    WARNING: 'warning',
    INFO: 'info',
};

// Toast provider component
export const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);

    // Add a new toast
    const addToast = useCallback((message, severity = TOAST_SEVERITY.INFO, duration = 5000) => {
        const id = uuidv4();
        const newToast = {
            id,
            message,
            severity,
            duration,
        };

        setToasts((currentToasts) => [...currentToasts, newToast]);

        // Auto-dismiss toast after duration
        if (duration !== 0) {
            setTimeout(() => {
                removeToast(id);
            }, duration);
        }

        return id;
    }, []);

    // Remove a toast by ID
    const removeToast = useCallback((id) => {
        setToasts((currentToasts) => currentToasts.filter((toast) => toast.id !== id));
    }, []);

    // Context value
    const contextValue = {
        toasts,
        addToast,
        removeToast,
        // Helper functions for different severity levels
        showSuccess: (message, duration) => addToast(message, TOAST_SEVERITY.SUCCESS, duration),
        showError: (message, duration) => addToast(message, TOAST_SEVERITY.ERROR, duration),
        showWarning: (message, duration) => addToast(message, TOAST_SEVERITY.WARNING, duration),
        showInfo: (message, duration) => addToast(message, TOAST_SEVERITY.INFO, duration),
    };

    return (
        <ToastContext.Provider value={contextValue}>
            {children}
            {/* You can also include a Toast display component here if needed */}
        </ToastContext.Provider>
    );
};

// Custom hook to use the toast context
export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};

export default ToastContext;
