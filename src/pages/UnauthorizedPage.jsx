import React from 'react';
import { Link } from 'react-router-dom';
import { useUser } from '../context/UserContext';

const UnauthorizedPage = () => {
    const { currentUser } = useUser();

    return (
        <div className="unauthorized-page">
            <h1>Access Denied</h1>
            <p>You do not have permission to access this resource.</p>
            <p>Please contact an administrator if you believe this is an error.</p>

            {currentUser ? (
                <Link to="/home" className="btn-primary">Go to Dashboard</Link>
            ) : (
                <Link to="/" className="btn-primary">Return to Home</Link>
            )}
        </div>
    );
};

export default UnauthorizedPage;
