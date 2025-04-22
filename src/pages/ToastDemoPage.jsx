import React from 'react';
import { useToast } from '../contexts/ToastContext';

const ToastDemoPage = () => {
    const { showSuccess, showError, showInfo, showWarning } = useToast();

    return (
        <div className="toast-demo-page">
            <div className="container">
                <h1>Toast Notification Demo</h1>
                <p>Click the buttons below to see different types of toast notifications.</p>

                <div className="button-grid">
                    <button
                        className="demo-button success"
                        onClick={() => showSuccess('Operation completed successfully!')}
                    >
                        Show Success Toast
                    </button>

                    <button
                        className="demo-button error"
                        onClick={() => showError('Something went wrong. Please try again.')}
                    >
                        Show Error Toast
                    </button>

                    <button
                        className="demo-button info"
                        onClick={() => showInfo('Here is some useful information.')}
                    >
                        Show Info Toast
                    </button>

                    <button
                        className="demo-button warning"
                        onClick={() => showWarning('Be careful with this action.')}
                    >
                        Show Warning Toast
                    </button>

                    <button
                        className="demo-button"
                        onClick={() => showSuccess('This toast will auto-close in 2 seconds', 2000)}
                    >
                        Short Duration Toast (2s)
                    </button>

                    <button
                        className="demo-button"
                        onClick={() => showInfo('This toast will stay longer (10 seconds)', 10000)}
                    >
                        Long Duration Toast (10s)
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ToastDemoPage;
