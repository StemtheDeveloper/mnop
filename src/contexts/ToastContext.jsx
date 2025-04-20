import React, { createContext, useContext, useState, useCallback } from 'react';
import ToastNotification from '../components/ToastNotification';
import { createPortal } from 'react-dom';

const ToastContext = createContext(null);

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};

export const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);

    const showToast = useCallback((message, type = 'info', duration = 5000) => {
        const id = Date.now().toString();
        setToasts(prevToasts => [...prevToasts, { id, message, type, duration }]);
        return id;
    }, []);

    const hideToast = useCallback((id) => {
        setToasts(prevToasts => prevToasts.filter(toast => toast.id !== id));
    }, []);

    // Convenience methods for different toast types
    const success = useCallback((message, duration) =>
        showToast(message, 'success', duration), [showToast]);

    const error = useCallback((message, duration) =>
        showToast(message, 'error', duration), [showToast]);

    const warning = useCallback((message, duration) =>
        showToast(message, 'warning', duration), [showToast]);

    const info = useCallback((message, duration) =>
        showToast(message, 'info', duration), [showToast]);

    return (
        <ToastContext.Provider value={{ showToast, hideToast, success, error, warning, info }}>
            {children}
            {createPortal(
                <div className="toast-container">
                    {toasts.map(toast => (
                        <ToastNotification
                            key={toast.id}
                            message={toast.message}
                            type={toast.type}
                            duration={toast.duration}
                            onClose={() => hideToast(toast.id)}
                        />
                    ))}
                </div>,
                document.body
            )}
        </ToastContext.Provider>
    );
};

export default ToastContext;
