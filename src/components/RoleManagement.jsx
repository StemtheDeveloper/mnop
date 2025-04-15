import React, { useState } from 'react';
import { useUser } from '../context/UserContext';

// Available roles in the system
const AVAILABLE_ROLES = [
    { id: 'designer', name: 'Designer', description: 'Create and manage product designs' },
    { id: 'manufacturer', name: 'Manufacturer', description: 'Provide manufacturing quotes and services' },
    { id: 'investor', name: 'Investor', description: 'Fund projects and track investments' },
    { id: 'customer', name: 'Customer', description: 'Purchase products' },
    { id: 'admin', name: 'Administrator', description: 'Manage system and users' }
];

const RoleManagement = ({ userId, currentRoles = [], onChange, readOnly = false }) => {
    const { addUserRole, removeUserRole, setPrimaryRole, currentUser } = useUser();
    const [isUpdating, setIsUpdating] = useState(false);
    const [message, setMessage] = useState(null);

    // Handle adding a new role to the user
    const handleAddRole = async (roleId) => {
        setIsUpdating(true);
        setMessage(null);

        try {
            const targetUserId = userId || currentUser?.uid;
            if (!targetUserId) {
                throw new Error("No user ID provided");
            }

            await addUserRole(targetUserId, roleId);
            setMessage({ type: 'success', text: `Added ${roleId} role successfully.` });

            // Notify parent component if provided
            if (onChange) {
                const newRoles = [...currentRoles, roleId];
                onChange(newRoles);
            }
        } catch (error) {
            console.error("Error adding role:", error);
            setMessage({ type: 'error', text: `Failed to add role: ${error.message}` });
        } finally {
            setIsUpdating(false);
        }
    };

    // Handle removing a role
    const handleRemoveRole = async (roleId) => {
        setIsUpdating(true);
        setMessage(null);

        try {
            const targetUserId = userId || currentUser?.uid;
            if (!targetUserId) {
                throw new Error("No user ID provided");
            }

            await removeUserRole(targetUserId, roleId);
            setMessage({ type: 'success', text: `Removed ${roleId} role successfully.` });

            // Notify parent component if provided
            if (onChange) {
                const newRoles = currentRoles.filter(role => role !== roleId);
                onChange(newRoles);
            }
        } catch (error) {
            console.error("Error removing role:", error);
            setMessage({ type: 'error', text: `Failed to remove role: ${error.message}` });
        } finally {
            setIsUpdating(false);
        }
    };

    // Handle setting a role as primary
    const handleSetPrimary = async (roleId) => {
        setIsUpdating(true);
        setMessage(null);

        try {
            await setPrimaryRole(roleId);
            setMessage({ type: 'success', text: `Set ${roleId} as primary role.` });

            // Notify parent component if provided
            if (onChange) {
                // Reorder roles with the primary first
                const newRoles = [
                    roleId,
                    ...currentRoles.filter(role => role !== roleId)
                ];
                onChange(newRoles);
            }
        } catch (error) {
            console.error("Error setting primary role:", error);
            setMessage({ type: 'error', text: `Failed to set primary role: ${error.message}` });
        } finally {
            setIsUpdating(false);
        }
    };

    // Format array of roles as user-friendly text
    const formatRoleList = (roles) => {
        if (!roles || roles.length === 0) return "None";

        return roles.map(role => {
            const foundRole = AVAILABLE_ROLES.find(r => r.id === role);
            return foundRole ? foundRole.name : role;
        }).join(', ');
    };

    return (
        <div className="role-management">
            <h3>Manage Roles</h3>

            {message && (
                <div className={`message ${message.type}`}>
                    {message.text}
                </div>
            )}

            <div className="current-roles">
                <h4>Current Roles</h4>
                {currentRoles.length === 0 ? (
                    <p>No roles assigned</p>
                ) : (
                    <ul className="role-list">
                        {currentRoles.map((role, index) => (
                            <li key={role} className={`role-item ${index === 0 ? 'primary' : ''}`}>
                                <span className={`role-badge ${role}`}>{role}</span>
                                {!readOnly && (
                                    <div className="role-actions">
                                        {index !== 0 && (
                                            <button
                                                onClick={() => handleSetPrimary(role)}
                                                disabled={isUpdating}
                                                title="Make primary role"
                                                className="role-action-button primary-button"
                                            >
                                                Make Primary
                                            </button>
                                        )}
                                        <button
                                            onClick={() => handleRemoveRole(role)}
                                            disabled={isUpdating}
                                            title="Remove role"
                                            className="role-action-button remove-button"
                                        >
                                            Remove
                                        </button>
                                    </div>
                                )}
                                {index === 0 && (
                                    <span className="primary-indicator">Primary</span>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {!readOnly && (
                <div className="add-role-section">
                    <h4>Add Role</h4>
                    <div className="available-roles">
                        {AVAILABLE_ROLES
                            .filter(role => !currentRoles.includes(role.id))
                            .map(role => (
                                <div key={role.id} className="role-option">
                                    <div className="role-info">
                                        <span className={`role-badge ${role.id}`}>{role.name}</span>
                                        <p className="role-description">{role.description}</p>
                                    </div>
                                    <button
                                        onClick={() => handleAddRole(role.id)}
                                        disabled={isUpdating}
                                        className="add-role-button"
                                    >
                                        Add
                                    </button>
                                </div>
                            ))
                        }
                    </div>
                </div>
            )}
        </div>
    );
};

export default RoleManagement;
