import React, { useEffect } from 'react';
import { useToast } from '../context/ToastContext';
import { TOAST_SEVERITY } from '../context/ToastContext';

const Toast = ({ toast, onClose }) => {
    const { id, message, severity, duration } = toast;

    useEffect(() => {
        if (duration !== 0) {
            const timer = setTimeout(() => {
                onClose(id);
            }, duration);
            return () => clearTimeout(timer);
        }
    }, [id, duration, onClose]);

    // Determine background color based on severity
    const getBgColor = () => {
        switch (severity) {
            case TOAST_SEVERITY.SUCCESS:
                return 'bg-green-500';
            case TOAST_SEVERITY.ERROR:
                return 'bg-red-500';
            case TOAST_SEVERITY.WARNING:
                return 'bg-yellow-500';
            case TOAST_SEVERITY.INFO:
            default:
                return 'bg-blue-500';
        }
    };

    return (
        <div
            className={`${getBgColor()} text-white px-4 py-3 rounded-md shadow-lg flex justify-between items-center mb-2`}
            role="alert"
        >
            <div>{message}</div>
            <button
                onClick={() => onClose(id)}
                className="text-white hover:text-gray-200 focus:outline-none ml-4"
            >
                <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M6 18L18 6M6 6l12 12"
                    ></path>
                </svg>
            </button>
        </div>
    );
};

const ToastContainer = () => {
    const { toasts, removeToast } = useToast();

    return (
        <div className="fixed top-5 right-5 z-50 flex flex-col w-72">
            {toasts.map((toast) => (
                <Toast key={toast.id} toast={toast} onClose={removeToast} />
            ))}
        </div>
    );
};

export default ToastContainer;
