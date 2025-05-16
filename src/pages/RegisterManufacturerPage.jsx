import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { useToast } from '../context/ToastContext';
import LoadingSpinner from '../components/LoadingSpinner';

const RegisterManufacturerPage = () => {
    const { currentUser } = useUser();
    const navigate = useNavigate();
    const { error: showError } = useToast();

    useEffect(() => {
        // Check if user is signed in
        if (!currentUser) {
            showError('Please sign in to register as a manufacturer');
            navigate('/signin', {
                state: {
                    from: '/role-registration/manufacturer',
                    message: 'Please sign in to register as a manufacturer.'
                }
            });
            return;
        }

        // If user is already a manufacturer, redirect to verification
        if (currentUser.roles && currentUser.roles.includes('manufacturer')) {
            navigate('/verification-request/manufacturer');
            return;
        }

        // Otherwise, redirect to role registration
        navigate('/role-registration/manufacturer');
    }, [currentUser, navigate, showError]);

    return (
        <div className="loading-container">
            <LoadingSpinner />
            <p>Preparing manufacturer registration...</p>
        </div>
    );
};

export default RegisterManufacturerPage;
