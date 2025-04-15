import React from 'react';
import { Link } from 'react-router-dom';

const NotFoundPage = () => {
    return (
        <div className="container">
            <div className="not-found-page">
                <h1>404</h1>
                <h2>Page Not Found</h2>
                <p>The page you are looking for doesn't exist or has been moved.</p>
                <div className="not-found-actions">
                    <Link to="/" className="btn-primary">Return to Home</Link>
                    <Link to="/shop" className="btn-secondary">Browse Shop</Link>
                </div>
            </div>
        </div>
    );
};

export default NotFoundPage;
