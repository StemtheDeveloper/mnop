import React, { createContext, useContext, useState, useCallback } from 'react';
import ToastNotification from '../components/ToastNotification';
import { createPortal } from 'react-dom';

// Create the context with default values to avoid 'undefined' errors
const ToastContext = createContext({
    showToast: () => { },
    hideToast: () => { },
    success: () => { },
    error: () => { },
    warning: () => { },
    info: () => { }
});

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};

export const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);

    const showToast = useCallback((options) => {
        // Handle both legacy string format and new object format
        if (typeof options === 'string') {
            // Legacy format: showToast(message, type, duration)
            const message = options;
            const type = arguments[1] || 'info';
            const duration = arguments[2] || 5000;
            
            const id = Date.now().toString();
            setToasts(prevToasts => [...prevToasts, { id, message, type, duration }]);
            return id;
        } else {
            // New object format: showToast({ type, title, message, link, duration, notification })
            const id = Date.now().toString();
            const toast = {
                id,
                type: options.type || 'info',
                title: options.title,
                message: options.message,
                link: options.link,
                duration: options.duration || 5000,
                notification: options.notification
            };
            
            setToasts(prevToasts => [...prevToasts, toast]);
            return id;
        }
    }, []);

    const hideToast = useCallback((id) => {
        setToasts(prevToasts => prevToasts.filter(toast => toast.id !== id));
    }, []);

    // Convenience methods for different toast types
    const success = useCallback((message, duration) => {
        if (typeof message === 'string') {
            return showToast({ type: 'success', message, duration });
        } else {
            return showToast({ ...message, type: 'success' });
        }
    }, [showToast]);

    const error = useCallback((message, duration) => {
        if (typeof message === 'string') {
            return showToast({ type: 'error', message, duration });
        } else {
            return showToast({ ...message, type: 'error' });
        }
    }, [showToast]);

    const warning = useCallback((message, duration) => {
        if (typeof message === 'string') {
            return showToast({ type: 'warning', message, duration });
        } else {
            return showToast({ ...message, type: 'warning' });
        }
    }, [showToast]);

    const info = useCallback((message, duration) => {
        if (typeof message === 'string') {
            return showToast({ type: 'info', message, duration });
        } else {
            return showToast({ ...message, type: 'info' });
        }
    }, [showToast]);

    return (
        <ToastContext.Provider value={{ showToast, hideToast, success, error, warning, info }}>
            {children}
            {createPortal(
                <div className="toast-container">
                    {toasts.map(toast => (
                        <ToastNotification
                            key={toast.id}
                            title={toast.title}
                            message={toast.message}
                            type={toast.type}
                            duration={toast.duration}
                            link={toast.link}
                            notification={toast.notification}
                            onClose={() => hideToast(toast.id)}
                        />
                    ))}
                </div>,
                document.body
            )}
        </ToastContext.Provider>
    );
};

// Export the context as default for backward compatibility
export default ToastContext;
