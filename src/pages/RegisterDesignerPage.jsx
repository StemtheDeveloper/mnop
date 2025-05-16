import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { useToast } from '../context/ToastContext';
import LoadingSpinner from '../components/LoadingSpinner';

const RegisterDesignerPage = () => {
    const { currentUser } = useUser();
    const navigate = useNavigate();
    const { error: showError } = useToast();

    useEffect(() => {
        // Check if user is signed in
        if (!currentUser) {
            showError('Please sign in to register as a designer');
            navigate('/signin', {
                state: {
                    from: '/role-registration/designer',
                    message: 'Please sign in to register as a designer.'
                }
            });
            return;
        }

        // If user is already a designer, redirect to verification
        if (currentUser.roles && currentUser.roles.includes('designer')) {
            navigate('/verification-request/designer');
            return;
        }

        // Otherwise, redirect to role registration
        navigate('/role-registration/designer');
    }, [currentUser, navigate, showError]);

    return (
        <div className="loading-container">
            <LoadingSpinner />
            <p>Preparing designer registration...</p>
        </div>
    );
};

export default RegisterDesignerPage;
