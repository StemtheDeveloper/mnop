import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useToast } from '../contexts/ToastContext';
import '../styles/UnauthorizedPage.css';

const UnauthorizedPage = () => {
    const { currentUser, userRoles, refreshUserData } = useUser();
    const { success: showSuccess, error: showError } = useToast();
    const location = useLocation();
    const navigate = useNavigate();
    const { requiredRoles } = location.state || {};

    // Format the required roles list for display
    const formatRolesList = (roles) => {
        if (!roles || roles.length === 0) return "";

        if (roles.length === 1) return roles[0];

        if (roles.length === 2) return `${roles[0]} or ${roles[1]}`;

        const lastRole = roles[roles.length - 1];
        const otherRoles = roles.slice(0, -1).join(', ');
        return `${otherRoles}, or ${lastRole}`;
    };

    // Handle requesting a new role
    const handleRequestRole = async (role) => {
        if (!currentUser) {
            showError("You must be logged in to request a role");
            return;
        }
        
        try {
            // Update user document to add the requested role
            const userRef = doc(db, 'users', currentUser.uid);
            await updateDoc(userRef, {
                roles: arrayUnion(role)
            });
            
            // Refresh user data to get updated roles
            await refreshUserData();
            
            showSuccess(`Role "${role}" has been added to your profile`);
            
            // Navigate back to where they came from
            setTimeout(() => {
                const from = location.state?.from || '/';
                navigate(from);
            }, 1500);
        } catch (error) {
            console.error("Error requesting role:", error);
            showError("Unable to add role. Please contact an administrator.");
        }
    };

    return (
        <div className="unauthorized-page">
            <h1>Access Denied</h1>

            {requiredRoles ? (
                <p>
                    You need to have the {formatRolesList(requiredRoles)} role
                    {requiredRoles.length > 1 ? 's' : ''} to access this page.
                </p>
            ) : (
                <p>You do not have permission to access this resource.</p>
            )}

            {currentUser && requiredRoles && (
                <div className="role-request-section">
                    <h2>Need Access?</h2>
                    <p>You can request to add one of these roles to your profile:</p>
                    <div className="role-buttons">
                        {requiredRoles.map(role => (
                            <button
                                key={role}
                                className="btn-secondary"
                                onClick={() => handleRequestRole(role)}
                                disabled={userRoles.includes(role)}
                            >
                                {userRoles.includes(role) ? `You already have ${role} role` : `Request ${role} role`}
                            </button>
                        ))}
                    </div>
                </div>
            )}

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
