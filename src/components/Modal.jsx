import React, { useEffect } from 'react';


const Modal = ({ title, children, onClose }) => {
    // Close modal when pressing escape key
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        document.addEventListener('keydown', handleKeyDown);

        // Prevent scrolling on the body when modal is open
        document.body.style.overflow = 'hidden';

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = 'auto';
        };
    }, [onClose]);

    // Handle click outside modal content
    const handleModalClick = (e) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    // Instead of using createPortal, we'll render the modal directly
    return (
        <div className="modal-overlay" onClick={handleModalClick}>
            <div className="modal-container">
                <div className="modal-header">
                    <h2>{title}</h2>
                    <button className="modal-close" onClick={onClose}>×</button>
                </div>
                <div className="modal-content">
                    {children}
                </div>
            </div>
        </div>
    );
};

export default Modal;
