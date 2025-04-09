import React from 'react';
import './ToastNotification.css';

const ToastNotification = ({ message, type }) => {
  return (
    <div className={`toast-notification ${type}`}>
      {message}
    </div>
  );
};

export default ToastNotification;
