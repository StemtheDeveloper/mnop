import React from 'react';
import { useToast } from '../context/ToastContext';
import ToastNotification from './ToastNotification';

const NotificationToastContainer = () => {
    const { showToast, hideToast, success, error, warning, info } = useToast();

    // This component doesn't need to render any toasts as the ToastProvider
    // already handles rendering them through a portal
    return null;
};

export default NotificationToastContainer;