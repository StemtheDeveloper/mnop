import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import LoadingSpinner from '../components/LoadingSpinner';
import userSearchService from '../services/userSearchService';
import '../styles/SearchPage.css';
import '../styles/UserSearchPage.css';

const UserSearchPage = () => {
    const [searchParams] = useSearchParams();
    const searchQuery = searchParams.get('query') || '';
    const { currentUser } = useUser();

    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchUsers = async () => {
            if (!searchQuery.trim()) {
                setUsers([]);
                setLoading(false);
                return;
            }

            setLoading(true);
            setError(null);

            try {
                const results = await userSearchService.searchUsersByRole(searchQuery);
                setUsers(results);
            } catch (err) {
                console.error('Error searching users:', err);
                setError('Failed to search users. Please try again.');
            } finally {
                setLoading(false);
            }
        };

        fetchUsers();
    }, [searchQuery]);

    return (
        <div className="search-page-container">
            <div className="search-header">
                <h1>User Search Results</h1>
                <p>
                    {searchQuery ? (
                        `Showing users matching "${searchQuery}" (${users.length} found)`
                    ) : (
                        'Enter a search term to find users'
                    )}
                </p>
            </div>

            {loading ? (
                <div className="loading-container">
                    <LoadingSpinner />
                    <p>Searching users...</p>
                </div>
            ) : error ? (
                <div className="error-message">
                    <p>{error}</p>
                </div>
            ) : users.length === 0 ? (
                <div className="no-results">
                    <h2>No users found</h2>
                    <p>Try searching with different keywords or refine your search.</p>
                    <p className="search-hint">You can only search for users with business roles like designers, manufacturers, and investors.</p>
                </div>
            ) : (
                <div className="search-section">
                    <h2 className="section-title">Found Users</h2>
                    <div className="users-grid">
                        {users.map(user => (
                            <div key={user.id} className="user-card">
                                <div className="user-avatar">
                                    {user.photoURL ? (
                                        <img src={user.photoURL} alt={user.displayName} />
                                    ) : (
                                        <div className="default-avatar">
                                            {user.displayName?.charAt(0) || user.email?.charAt(0) || 'U'}
                                        </div>
                                    )}
                                </div>
                                <div className="user-info">
                                    <h3 className="user-name">{user.displayName || 'User'}</h3>
                                    <div className="user-roles">
                                        {Array.isArray(user.roles) && user.roles.map(role => (
                                            role !== 'customer' && (
                                                <span key={role} className={`role-badge ${role}`}>
                                                    {role.charAt(0).toUpperCase() + role.slice(1)}
                                                </span>
                                            )
                                        ))}
                                    </div>
                                    <div className="user-actions">
                                        <Link to={`/profile/${user.id}`} className="view-profile-btn">
                                            View Profile
                                        </Link>
                                        <Link to={`/messages?userId=${user.id}`} className="message-btn">
                                            Message
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserSearchPage;