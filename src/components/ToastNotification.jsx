import React, { useEffect } from 'react';


const ToastNotification = ({ message, type, onClose, duration = 5000 }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [onClose, duration]);

  return (
    <div className={`toast-notification ${type}`}>
      <div className="toast-content">
        <div className="toast-message">{message}</div>
        <button
          className="toast-close-button"
          onClick={onClose}
          aria-label="Close notification"
        >
          ×
        </button>
      </div>
      <div className="toast-progress-bar" style={{ animationDuration: `${duration}ms` }} />
    </div>
  );
};

export default ToastNotification;
