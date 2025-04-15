import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useUser } from '../context/UserContext';

const UnauthorizedPage = () => {
    const { currentUser, userRole, addUserRole } = useUser();
    const location = useLocation();
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
        // In a real app, this might create a request for admin approval
        // For now, we'll simulate direct role addition
        try {
            await addUserRole(currentUser.uid, role);
            alert(`Role "${role}" has been added to your profile. You can now access this page.`);
        } catch (error) {
            console.error("Error requesting role:", error);
            alert("Unable to add role. Please contact an administrator.");
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
                            >
                                Request {role} role
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
