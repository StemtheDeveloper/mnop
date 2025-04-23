import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import './ToastNotification.css';

const ToastNotification = ({ title, message, type, link, notification, onClose, duration = 5000 }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [onClose, duration]);

  // Handle older format that only has message
  const displayTitle = title || (typeof message === 'object' ? null : null);
  const displayMessage = title ? message : (typeof message === 'object' ? JSON.stringify(message) : message);

  return (
    <div className={`toast-notification ${type}`}>
      <div className="toast-content">
        {displayTitle && <div className="toast-title">{displayTitle}</div>}
        <div className="toast-message">{displayMessage}</div>
        {link && (
          <Link to={link} className="toast-link" onClick={e => e.stopPropagation()}>
            View details
          </Link>
        )}
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
