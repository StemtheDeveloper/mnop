import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useUser } from '../context/UserContext';

const SimpleAuthGuard = ({ children }) => {
    const userContext = useUser();
    console.log('Simple Auth Guard - userContext:', userContext);

    // Simply return the children for now to debug
    return (
        <div>
            <div style={{ padding: '10px', margin: '10px', background: '#f0f0f0', border: '1px solid #ccc' }}>
                <h3>Simple Auth Guard</h3>
                <p>User is: {userContext?.currentUser ? 'Logged In' : 'Not Logged In'}</p>
            </div>
            {children}
        </div>
    );
};

export default SimpleAuthGuard;
