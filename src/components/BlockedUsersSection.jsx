import React, { useState, useEffect } from 'react';
import { useUser } from '../context/UserContext';
import blockService from '../services/blockService';
import LoadingSpinner from './LoadingSpinner';
import '../styles/BlockedUsers.css';

const BlockedUsersSection = () => {
    const { currentUser } = useUser();
    const [blockedUsers, setBlockedUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [processingId, setProcessingId] = useState(null);

    // Fetch blocked users when component mounts
    useEffect(() => {
        if (!currentUser?.uid) return;

        const fetchBlockedUsers = async () => {
            setLoading(true);
            try {
                const users = await blockService.getBlockedUsers(currentUser.uid);
                setBlockedUsers(users);
                setError(null);
            } catch (err) {
                console.error('Error fetching blocked users:', err);
                setError('Failed to load blocked users. Please try again.');
            } finally {
                setLoading(false);
            }
        };

        fetchBlockedUsers();
    }, [currentUser]);

    // Handle unblocking a user
    const handleUnblock = async (userId) => {
        if (processingId) return;

        setProcessingId(userId);
        try {
            const result = await blockService.unblockUser(currentUser.uid, userId);

            if (result.success) {
                // Remove the unblocked user from the list
                setBlockedUsers(current => current.filter(user => user.userId !== userId));
            } else {
                setError(`Failed to unblock user: ${result.error}`);
            }
        } catch (err) {
            console.error('Error unblocking user:', err);
            setError('An error occurred while unblocking the user.');
        } finally {
            setProcessingId(null);
        }
    };

    // Toggle content blocking for a user
    const handleToggleContentBlocking = async (userId, currentValue) => {
        if (processingId) return;

        setProcessingId(userId);
        try {
            const result = await blockService.blockUser(currentUser.uid, userId, !currentValue);

            if (result.success) {
                // Update the blocked users list
                setBlockedUsers(current =>
                    current.map(user =>
                        user.userId === userId
                            ? { ...user, blockContent: !currentValue }
                            : user
                    )
                );
            } else {
                setError(`Failed to update settings: ${result.error}`);
            }
        } catch (err) {
            console.error('Error updating block settings:', err);
            setError('An error occurred while updating block settings.');
        } finally {
            setProcessingId(null);
        }
    };

    if (loading) {
        return (
            <div className="blocked-users-section">
                <h3>Blocked Users</h3>
                <div className="blocked-users-loading">
                    <LoadingSpinner />
                    <p>Loading blocked users...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="blocked-users-section">
            <h3>Blocked Users</h3>

            {error && (
                <div className="blocked-users-error">
                    <p>{error}</p>
                </div>
            )}

            {blockedUsers.length === 0 ? (
                <div className="no-blocked-users">
                    <p>You haven't blocked any users yet.</p>
                </div>
            ) : (
                <div className="blocked-users-list">
                    {blockedUsers.map((user) => (
                        <div key={user.userId} className="blocked-user-item">
                            <div className="blocked-user-info">
                                <div className="blocked-user-avatar">
                                    {user.photoURL ? (
                                        <img src={user.photoURL} alt={user.displayName} />
                                    ) : (
                                        <div className="default-avatar">
                                            {user.displayName?.charAt(0) || 'U'}
                                        </div>
                                    )}
                                </div>
                                <div className="blocked-user-details">
                                    <h4>{user.displayName}</h4>
                                    <p className="blocked-since">
                                        Blocked since: {new Date(user.blockedAt).toLocaleDateString()}
                                    </p>
                                </div>
                            </div>
                            <div className="blocked-user-actions">
                                <label className="block-content-toggle">
                                    <input
                                        type="checkbox"
                                        checked={user.blockContent}
                                        onChange={() => handleToggleContentBlocking(user.userId, user.blockContent)}
                                        disabled={processingId === user.userId}
                                    />
                                    Also block content
                                </label>
                                <button
                                    className="unblock-button"
                                    onClick={() => handleUnblock(user.userId)}
                                    disabled={processingId === user.userId}
                                >
                                    {processingId === user.userId ? 'Processing...' : 'Unblock'}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default BlockedUsersSection;
