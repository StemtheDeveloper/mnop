import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, updateDoc, writeBatch, deleteDoc, query, orderBy, limit, startAfter, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useUser } from '../context/UserContext';
import AuthGuard from '../components/AuthGuard';
import LoadingSpinner from '../components/LoadingSpinner';
import InterestRateAdminPanel from '../components/admin/InterestRateAdminPanel';
import MarketRatesPanel from '../components/admin/MarketRatesPanel';
import ProductArchivePanel from '../components/admin/ProductArchivePanel';
import TrendingProductsPanel from '../components/admin/TrendingProductsPanel';
import ProductApprovalPanel from '../components/admin/ProductApprovalPanel';
import PaymentSettingsPanel from '../components/admin/PaymentSettingsPanel';
import FirestoreIndexHelper from '../components/admin/FirestoreIndexHelper';
import NopsManagementPanel from '../components/admin/NopsManagementPanel';
import AchievementsManagementPanel from '../components/admin/AchievementsManagementPanel';
import '../styles/AdminTools.css';

// Available roles in the system
const AVAILABLE_ROLES = [
    { id: 'customer', name: 'Customer', description: 'Purchase products' },
    { id: 'designer', name: 'Designer', description: 'Create and manage product designs' },
    { id: 'manufacturer', name: 'Manufacturer', description: 'Provide manufacturing quotes and services' },
    { id: 'investor', name: 'Investor', description: 'Fund projects and track investments' },
    { id: 'admin', name: 'Administrator', description: 'Manage system and users' }
];

const AdminPage = ({ activeTab: initialActiveTab }) => {
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState({ success: false, message: '', details: null });
    const [operation, setOperation] = useState('');

    // Fix: Check the actual function names in the UserContext
    const { currentUser, userRole, loading: userLoading } = useUser();
    const userContext = useUser(); // Get the full context to access methods

    const [activeTab, setActiveTab] = useState(initialActiveTab || 'users');

    // Admin's own role management state
    const [adminRoles, setAdminRoles] = useState([]);
    const [selfRoleLoading, setSelfRoleLoading] = useState(false);
    const [selfRoleMessage, setSelfRoleMessage] = useState({ type: '', text: '' });

    // User management state
    const [users, setUsers] = useState([]);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [lastVisible, setLastVisible] = useState(null);
    const [hasMoreUsers, setHasMoreUsers] = useState(true);
    const [selectedUser, setSelectedUser] = useState(null);
    const [roleModalOpen, setRoleModalOpen] = useState(false);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [filteredUsers, setFilteredUsers] = useState([]);
    const [newRole, setNewRole] = useState('');
    const [confirmDelete, setConfirmDelete] = useState('');

    // Constants
    const USER_ROLES = ['customer', 'designer', 'manufacturer', 'investor', 'admin'];
    const USERS_PER_PAGE = 20;

    // Initialize admin roles from userRole
    useEffect(() => {
        if (userRole) {
            if (Array.isArray(userRole)) {
                setAdminRoles([...userRole]);
            } else {
                setAdminRoles([userRole]);
            }
        }
    }, [userRole]);

    // Define our own functions to add and remove roles
    const addRoleDirectly = async (userId, roleId) => {
        try {
            // Get the current user document
            const userRef = doc(db, 'users', userId);
            const userSnap = await getDoc(userRef);

            if (!userSnap.exists()) {
                throw new Error('User document not found');
            }

            const userData = userSnap.data();

            // Check if user already has roles array
            let currentRoles = [];
            if (Array.isArray(userData.roles)) {
                currentRoles = [...userData.roles];
            } else if (userData.role) {
                currentRoles = [userData.role];
            } else {
                currentRoles = ['customer']; // Default role if none exists
            }

            // Add the new role if not already present
            if (!currentRoles.includes(roleId)) {
                currentRoles.push(roleId);

                // Update Firestore
                await updateDoc(userRef, {
                    roles: currentRoles,
                    role: roleId, // Update single role field for backward compatibility
                    updatedAt: new Date()
                });

                return true;
            }

            return false; // Role already exists
        } catch (error) {
            console.error('Error adding role:', error);
            throw error;
        }
    };

    const removeRoleDirectly = async (userId, roleId) => {
        try {
            // Get the current user document
            const userRef = doc(db, 'users', userId);
            const userSnap = await getDoc(userRef);

            if (!userSnap.exists()) {
                throw new Error('User document not found');
            }

            const userData = userSnap.data();

            // Check if user has roles array
            let currentRoles = [];
            if (Array.isArray(userData.roles)) {
                currentRoles = [...userData.roles];
            } else if (userData.role) {
                currentRoles = [userData.role];
            } else {
                return false; // No roles to remove
            }

            // Remove the role if present
            if (currentRoles.includes(roleId)) {
                const newRoles = currentRoles.filter(role => role !== roleId);

                // Don't allow removing the last role or all roles
                if (newRoles.length === 0) {
                    newRoles.push('customer'); // Default to customer if removing last role
                }

                // Update Firestore
                await updateDoc(userRef, {
                    roles: newRoles,
                    role: newRoles[0], // Update single role field with first role
                    updatedAt: new Date()
                });

                return true;
            }

            return false; // Role didn't exist
        } catch (error) {
            console.error('Error removing role:', error);
            throw error;
        }
    };

    // Function to handle adding a role to the admin's own account
    const handleAddSelfRole = async (roleId) => {
        if (!currentUser || adminRoles.includes(roleId)) return;

        setSelfRoleLoading(true);
        setSelfRoleMessage({ type: '', text: '' });

        try {
            // Use our direct function instead of relying on context
            const success = await addRoleDirectly(currentUser.uid, roleId);

            if (success) {
                // Update local state
                setAdminRoles(prev => [...prev, roleId]);
                setSelfRoleMessage({
                    type: 'success',
                    text: `Successfully added ${roleId} role to your account!`
                });
            } else {
                setSelfRoleMessage({
                    type: 'error',
                    text: 'Failed to update role. Please try again.'
                });
            }
        } catch (error) {
            console.error('Error adding role:', error);
            setSelfRoleMessage({
                type: 'error',
                text: `Error: ${error.message}`
            });
        } finally {
            setSelfRoleLoading(false);
        }
    };

    // Function to handle removing a role from the admin's own account
    const handleRemoveSelfRole = async (roleId) => {
        // Prevent removing admin role from admin page
        if (!currentUser || roleId === 'admin') {
            setSelfRoleMessage({
                type: 'warning',
                text: 'You cannot remove the admin role while on the admin page.'
            });
            return;
        }

        setSelfRoleLoading(true);
        setSelfRoleMessage({ type: '', text: '' });

        try {
            // Use our direct function instead of relying on context
            const success = await removeRoleDirectly(currentUser.uid, roleId);

            if (success) {
                // Update local state
                setAdminRoles(prev => prev.filter(role => role !== roleId));
                setSelfRoleMessage({
                    type: 'success',
                    text: `Successfully removed ${roleId} role from your account.`
                });
            } else {
                setSelfRoleMessage({
                    type: 'warning',
                    text: `Could not remove the ${roleId} role. It may not exist.`
                });
            }
        } catch (error) {
            console.error('Error removing role:', error);
            setSelfRoleMessage({
                type: 'error',
                text: `Error: ${error.message}`
            });
        } finally {
            setSelfRoleLoading(false);
        }
    };

    // Add a debug function to see available methods
    const debugUserContext = () => {
        console.log("Available methods in UserContext:",
            Object.keys(userContext).filter(key => typeof userContext[key] === 'function'));
        setSelfRoleMessage({
            type: 'info',
            text: 'Available methods logged to console. Check browser developer tools.'
        });
    };

    // Fetch users on component mount
    useEffect(() => {
        fetchUsers();
    }, []);

    // Filter users based on search term
    useEffect(() => {
        if (searchTerm.trim() === '') {
            setFilteredUsers(users);
        } else {
            const lowercaseSearch = searchTerm.toLowerCase();
            const filtered = users.filter(user =>
                user.displayName?.toLowerCase().includes(lowercaseSearch) ||
                user.email?.toLowerCase().includes(lowercaseSearch)
            );
            setFilteredUsers(filtered);
        }
    }, [users, searchTerm]);

    // Fetch users from Firestore
    const fetchUsers = async (loadMore = false) => {
        setLoadingUsers(true);

        try {
            const usersRef = collection(db, 'users');
            let q;

            if (loadMore && lastVisible) {
                q = query(
                    usersRef,
                    orderBy('email'),
                    startAfter(lastVisible),
                    limit(USERS_PER_PAGE)
                );
            } else {
                q = query(
                    usersRef,
                    orderBy('email'),
                    limit(USERS_PER_PAGE)
                );
            }

            const snapshot = await getDocs(q);

            // Get the last visible document for pagination
            const lastVisible = snapshot.docs[snapshot.docs.length - 1];
            setLastVisible(lastVisible);

            // Check if there are more users to load
            setHasMoreUsers(snapshot.docs.length === USERS_PER_PAGE);

            // Convert to user objects with proper ID
            const userList = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            if (loadMore) {
                // Append to existing users
                setUsers(prevUsers => [...prevUsers, ...userList]);
            } else {
                // Replace existing users
                setUsers(userList);
            }
        } catch (error) {
            console.error('Error fetching users:', error);
            setResult({
                success: false,
                message: `Failed to fetch users: ${error.message}`,
                details: null
            });
        } finally {
            setLoadingUsers(false);
        }
    };

    // Load more users with pagination
    const loadMoreUsers = () => {
        if (hasMoreUsers && !loadingUsers) {
            fetchUsers(true);
        }
    };

    // Open role modal for a user
    const openRoleModal = (user) => {
        setSelectedUser(user);
        setNewRole('');
        setRoleModalOpen(true);
    };

    // Open delete modal for a user
    const openDeleteModal = (user) => {
        setSelectedUser(user);
        setConfirmDelete('');
        setDeleteModalOpen(true);
    };

    // Update user's role
    const updateUserRole = async () => {
        if (!selectedUser || !newRole) return;

        setLoading(true);
        setResult({ success: false, message: 'Updating user role...', details: null });

        try {
            const success = await addRoleDirectly(selectedUser.id, newRole);

            if (success) {
                // Get current roles to update local state
                const userRef = doc(db, 'users', selectedUser.id);
                const userSnap = await getDoc(userRef);
                const userData = userSnap.data();

                // Update local state
                setUsers(prevUsers => prevUsers.map(user =>
                    user.id === selectedUser.id
                        ? {
                            ...user,
                            roles: userData.roles,
                            role: userData.role
                        }
                        : user
                ));

                setResult({
                    success: true,
                    message: `Updated ${selectedUser.email} with role: ${newRole}`,
                    details: null
                });

                // Close modal
                setRoleModalOpen(false);
            } else {
                setResult({
                    success: false,
                    message: `User already has the ${newRole} role`,
                    details: null
                });
            }
        } catch (error) {
            console.error('Error updating user role:', error);
            setResult({
                success: false,
                message: `Failed to update role: ${error.message}`,
                details: null
            });
        } finally {
            setLoading(false);
        }
    };

    // Delete user account
    const deleteUserAccount = async () => {
        if (!selectedUser) return;

        // Check for confirmation text match
        if (confirmDelete !== selectedUser.email) {
            setResult({
                success: false,
                message: 'Email confirmation did not match. Account not deleted.',
                details: null
            });
            return;
        }

        setLoading(true);
        setResult({ success: false, message: 'Deleting user...', details: null });

        try {
            // Delete user document
            await deleteDoc(doc(db, 'users', selectedUser.id));

            // Update local state
            setUsers(prevUsers => prevUsers.filter(user => user.id !== selectedUser.id));

            setResult({
                success: true,
                message: `Successfully deleted user: ${selectedUser.email}`,
                details: null
            });

            // Close modal
            setDeleteModalOpen(false);
        } catch (error) {
            console.error('Error deleting user:', error);
            setResult({
                success: false,
                message: `Failed to delete user: ${error.message}`,
                details: null
            });
        } finally {
            setLoading(false);
        }
    };

    // Format role display
    const formatRoleDisplay = (user) => {
        if (Array.isArray(user.roles)) {
            return user.roles.join(', ');
        } else if (user.role) {
            return user.role;
        }
        return 'customer';
    };

    // Original admin functions
    const updateRoleStructure = async () => {
        setLoading(true);
        setResult({ success: false, message: 'Processing...', details: null });
        setOperation('role-migration');

        try {
            const usersRef = collection(db, 'users');
            const snapshot = await getDocs(usersRef);

            // Use batched writes for better performance and atomicity
            const batch = writeBatch(db);
            let updatedCount = 0;
            let skippedCount = 0;
            let errorCount = 0;
            const errors = [];

            snapshot.forEach((document) => {
                const userData = document.data();

                // Check if user has old role structure but not new roles array
                if (userData.role && !userData.roles) {
                    const userRef = doc(db, 'users', document.id);
                    batch.update(userRef, {
                        roles: [userData.role], // Convert single role to array of roles
                        rolesMigrated: true,
                        lastUpdated: new Date()
                    });
                    updatedCount++;
                } else if (userData.roles) {
                    // Already has roles array
                    skippedCount++;
                } else if (!userData.role && !userData.roles) {
                    // Neither old nor new structure exists
                    const userRef = doc(db, 'users', document.id);
                    batch.update(userRef, {
                        roles: ['user'], // Default role
                        role: 'user',  // For backward compatibility
                        rolesMigrated: true,
                        lastUpdated: new Date()
                    });
                    updatedCount++;
                    errors.push({
                        userId: document.id,
                        error: 'No role information found, added default "user" role'
                    });
                }
            });

            // Commit all the batched writes
            await batch.commit();

            setResult({
                success: true,
                message: `Operation completed: ${updatedCount} users updated, ${skippedCount} users skipped (already had roles array)`,
                details: {
                    updated: updatedCount,
                    skipped: skippedCount,
                    errors: errorCount,
                    errorList: errors
                }
            });

        } catch (error) {
            console.error('Error updating user role structure:', error);
            setResult({
                success: false,
                message: `Error: ${error.message}`,
                details: { error: error.toString() }
            });
        } finally {
            setLoading(false);
        }
    };

    const cleanupOrphanedData = async () => {
        setLoading(true);
        setResult({ success: false, message: 'Searching for orphaned data...', details: null });
        setOperation('cleanup');

        try {
            // Implementation would go here
            setResult({
                success: true,
                message: 'Cleanup operation not yet implemented',
                details: null
            });
        } catch (error) {
            setResult({
                success: false,
                message: `Error: ${error.message}`,
                details: { error: error.toString() }
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <AuthGuard allowedRoles="admin">
            <div className="admin-page">
                <div className="admin-container">
                    <h1>Admin Dashboard</h1>

                    {/* Admin Self-Role Management Section */}
                    <div className="admin-section admin-self-role-section">
                        <h2>Your Account Roles</h2>

                        {selfRoleMessage.text && (
                            <div className={`message ${selfRoleMessage.type}`}>
                                {selfRoleMessage.text}
                            </div>
                        )}

                        {/* Debug button to help identify available methods */}
                        <button
                            onClick={debugUserContext}
                            className="debug-button"
                        >
                            Debug Available Methods
                        </button>

                        <div className="current-roles">
                            <h3>Current Roles</h3>
                            {adminRoles.length === 0 ? (
                                <p>No roles assigned</p>
                            ) : (
                                <ul className="role-list">
                                    {adminRoles.map((role, index) => (
                                        <li key={role} className="role-item">
                                            <span className={`role-badge ${role}`}>{role}</span>
                                            {role !== 'admin' && (
                                                <button
                                                    onClick={() => handleRemoveSelfRole(role)}
                                                    disabled={selfRoleLoading}
                                                    className="role-action-button remove-button"
                                                >
                                                    Remove
                                                </button>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>

                        <div className="add-role-section">
                            <h3>Add Role to Your Account</h3>
                            <div className="available-roles">
                                {AVAILABLE_ROLES
                                    .filter(role => !adminRoles.includes(role.id))
                                    .map(role => (
                                        <div key={role.id} className="role-option">
                                            <div className="role-info">
                                                <span className={`role-badge ${role.id}`}>{role.name}</span>
                                                <p>{role.description}</p>
                                            </div>
                                            <button
                                                onClick={() => handleAddSelfRole(role.id)}
                                                disabled={selfRoleLoading}
                                                className="add-role-button"
                                            >
                                                Add
                                            </button>
                                        </div>
                                    ))
                                }
                            </div>
                        </div>
                    </div>

                    <div className="admin-tabs">
                        <button
                            className={`tab-button ${activeTab === 'users' ? 'active' : ''}`}
                            onClick={() => setActiveTab('users')}
                        >
                            User Management
                        </button>
                        <button
                            className={`tab-button ${activeTab === 'products' ? 'active' : ''}`}
                            onClick={() => setActiveTab('products')}
                        >
                            Products
                        </button>
                        <button
                            className={`tab-button ${activeTab === 'achievements' ? 'active' : ''}`}
                            onClick={() => setActiveTab('achievements')}
                        >
                            Achievements
                        </button>
                        <button
                            className={`tab-button ${activeTab === 'collectibles' ? 'active' : ''}`}
                            onClick={() => setActiveTab('collectibles')}
                        >
                            Collectibles
                        </button>
                        <button
                            className={`tab-button ${activeTab === 'finance' ? 'active' : ''}`}
                            onClick={() => setActiveTab('finance')}
                        >
                            Finance
                        </button>
                        <button
                            className={`tab-button ${activeTab === 'settings' ? 'active' : ''}`}
                            onClick={() => setActiveTab('settings')}
                        >
                            Settings
                        </button>
                        <button
                            className={`tab-button ${activeTab === 'database' ? 'active' : ''}`}
                            onClick={() => setActiveTab('database')}
                        >
                            Database
                        </button>
                    </div>

                    <div className="tab-content">
                        {activeTab === 'users' && (
                            <div className="users-tab">
                                <div className="admin-section user-management-section">
                                    <h2>User Management</h2>
                                    <div className="search-bar">
                                        <input
                                            type="text"
                                            placeholder="Search users by name or email..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                        />
                                    </div>

                                    {loadingUsers && users.length === 0 ? (
                                        <div className="loading-container">
                                            <LoadingSpinner />
                                            <p>Loading users...</p>
                                        </div>
                                    ) : (
                                        <div className="users-table-container">
                                            <table className="users-table">
                                                <thead>
                                                    <tr>
                                                        <th>Email</th>
                                                        <th>Name</th>
                                                        <th>Role(s)</th>
                                                        <th>Created</th>
                                                        <th>Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {filteredUsers.map(user => (
                                                        <tr key={user.id}>
                                                            <td>{user.email}</td>
                                                            <td>{user.displayName || 'No Name'}</td>
                                                            <td className="role-cell">
                                                                <span className={`role-label ${Array.isArray(user.roles) ? user.roles[0] : user.role || 'customer'}`}>
                                                                    {formatRoleDisplay(user)}
                                                                </span>
                                                            </td>
                                                            <td>{user.createdAt ? new Date(user.createdAt.seconds * 1000).toLocaleDateString() : 'N/A'}</td>
                                                            <td className="action-cell">
                                                                <button
                                                                    className="admin-button small"
                                                                    onClick={() => openRoleModal(user)}
                                                                >
                                                                    Change Role
                                                                </button>
                                                                <button
                                                                    className="admin-button danger small"
                                                                    onClick={() => openDeleteModal(user)}
                                                                >
                                                                    Delete
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>

                                            {filteredUsers.length === 0 && (
                                                <div className="no-users-message">
                                                    <p>{searchTerm ? 'No users match your search' : 'No users found'}</p>
                                                </div>
                                            )}

                                            {hasMoreUsers && filteredUsers.length > 0 && searchTerm === '' && (
                                                <div className="load-more-container">
                                                    <button
                                                        className="load-more-button"
                                                        onClick={loadMoreUsers}
                                                        disabled={loadingUsers}
                                                    >
                                                        {loadingUsers ? 'Loading...' : 'Load More Users'}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className="admin-tools-section">
                                    <h2>Database Maintenance</h2>
                                    <div className="admin-card">
                                        <h3>Role Structure Migration</h3>
                                        <p>
                                            Update user documents to convert from single "role" field to an array of "roles".
                                            This is recommended for enabling users to have multiple roles.
                                        </p>
                                        <button
                                            className="admin-button"
                                            onClick={updateRoleStructure}
                                            disabled={loading}
                                        >
                                            {loading && operation === 'role-migration' ? 'Processing...' : 'Migrate Role Structure'}
                                        </button>
                                    </div>

                                    <div className="admin-card">
                                        <h3>Cleanup Orphaned Data</h3>
                                        <p>
                                            Scan for and remove orphaned data such as roles for non-existent users
                                            or references to deleted documents.
                                        </p>
                                        <button
                                            className="admin-button secondary"
                                            onClick={cleanupOrphanedData}
                                            disabled={loading}
                                        >
                                            {loading && operation === 'cleanup' ? 'Processing...' : 'Cleanup Data'}
                                        </button>
                                    </div>
                                </div>

                                {result.message && (
                                    <div className={`result-panel ${result.success ? 'success' : 'error'}`}>
                                        <h3>{result.success ? 'Success' : 'Error'}</h3>
                                        <p>{result.message}</p>

                                        {result.details && (
                                            <div className="details-section">
                                                <h4>Operation Details:</h4>
                                                <pre>{JSON.stringify(result.details, null, 2)}</pre>
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className="admin-log">
                                    <h3>Admin Activity Log</h3>
                                    <p>Last action by: {currentUser?.email || 'Unknown'}</p>
                                    <p>Time: {new Date().toLocaleString()}</p>
                                </div>

                                {/* Role Change Modal */}
                                {roleModalOpen && selectedUser && (
                                    <div className="modal-overlay">
                                        <div className="modal-container">
                                            <h2>Change User Role</h2>
                                            <div className="modal-content">
                                                <p><strong>User:</strong> {selectedUser.email}</p>
                                                <p><strong>Current Role(s):</strong> {formatRoleDisplay(selectedUser)}</p>

                                                <div className="form-group">
                                                    <label htmlFor="newRole">Add New Role:</label>
                                                    <select
                                                        id="newRole"
                                                        value={newRole}
                                                        onChange={(e) => setNewRole(e.target.value)}
                                                    >
                                                        <option value="">Select a role</option>
                                                        {USER_ROLES.map(role => (
                                                            <option key={role} value={role}>{role}</option>
                                                        ))}
                                                    </select>
                                                </div>

                                                <div className="modal-actions">
                                                    <button
                                                        className="admin-button"
                                                        onClick={updateUserRole}
                                                        disabled={!newRole || loading}
                                                    >
                                                        {loading ? 'Updating...' : 'Update Role'}
                                                    </button>
                                                    <button
                                                        className="admin-button secondary"
                                                        onClick={() => setRoleModalOpen(false)}
                                                        disabled={loading}
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Delete User Modal */}
                                {deleteModalOpen && selectedUser && (
                                    <div className="modal-overlay">
                                        <div className="modal-container">
                                            <h2>Delete User Account</h2>
                                            <div className="modal-content">
                                                <div className="warning-box">
                                                    <p>⚠️ Warning: This action cannot be undone!</p>
                                                    <p>Deleting this user will remove all their account information from the system.</p>
                                                </div>

                                                <p><strong>User:</strong> {selectedUser.email}</p>

                                                <div className="form-group">
                                                    <label htmlFor="confirmDelete">
                                                        Type <strong>{selectedUser.email}</strong> to confirm deletion:
                                                    </label>
                                                    <input
                                                        id="confirmDelete"
                                                        type="text"
                                                        value={confirmDelete}
                                                        onChange={(e) => setConfirmDelete(e.target.value)}
                                                        placeholder="Enter email to confirm"
                                                    />
                                                </div>

                                                <div className="modal-actions">
                                                    <button
                                                        className="admin-button danger"
                                                        onClick={deleteUserAccount}
                                                        disabled={confirmDelete !== selectedUser.email || loading}
                                                    >
                                                        {loading ? 'Deleting...' : 'Delete Account'}
                                                    </button>
                                                    <button
                                                        className="admin-button secondary"
                                                        onClick={() => setDeleteModalOpen(false)}
                                                        disabled={loading}
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'products' && (
                            <div className="products-tab">
                                <h2>Products Management</h2>
                                <ProductApprovalPanel />
                                <TrendingProductsPanel />
                                <ProductArchivePanel />
                                {/* Other product management components */}
                            </div>
                        )}

                        {activeTab === 'achievements' && (
                            <div className="achievements-tab">
                                <h2>Achievements & Badges Management</h2>
                                <AchievementsManagementPanel />
                            </div>
                        )}

                        {activeTab === 'collectibles' && (
                            <div className="collectibles-tab">
                                <h2>Collectibles Management</h2>
                                <NopsManagementPanel />
                                {/* Additional collectibles components can be added here */}
                            </div>
                        )}

                        {activeTab === 'finance' && (
                            <div className="finance-tab">
                                <h2>Financial Management</h2>

                                <PaymentSettingsPanel />
                                <MarketRatesPanel />
                                <InterestRateAdminPanel />

                                {/* Additional finance panels can be added here */}
                            </div>
                        )}

                        {activeTab === 'settings' && (
                            <div className="settings-tab">
                                {/* Existing Settings Content */}
                            </div>
                        )}

                        {activeTab === 'database' && (
                            <div className="database-tab">
                                <h2>Database Management</h2>
                                <FirestoreIndexHelper />

                                <div className="admin-section">
                                    <h2>Database Maintenance</h2>
                                    <div className="admin-card">
                                        <h3>Role Structure Migration</h3>
                                        <p>
                                            Update user documents to convert from single "role" field to an array of "roles".
                                            This is recommended for enabling users to have multiple roles.
                                        </p>
                                        <button
                                            className="admin-button"
                                            onClick={updateRoleStructure}
                                            disabled={loading}
                                        >
                                            {loading && operation === 'role-migration' ? 'Processing...' : 'Migrate Role Structure'}
                                        </button>
                                    </div>

                                    <div className="admin-card">
                                        <h3>Cleanup Orphaned Data</h3>
                                        <p>
                                            Scan for and remove orphaned data such as roles for non-existent users
                                            or references to deleted documents.
                                        </p>
                                        <button
                                            className="admin-button secondary"
                                            onClick={cleanupOrphanedData}
                                            disabled={loading}
                                        >
                                            {loading && operation === 'cleanup' ? 'Processing...' : 'Cleanup Data'}
                                        </button>
                                    </div>
                                </div>

                                {result.message && (
                                    <div className={`result-panel ${result.success ? 'success' : 'error'}`}>
                                        <h3>{result.success ? 'Success' : 'Error'}</h3>
                                        <p>{result.message}</p>

                                        {result.details && (
                                            <div className="details-section">
                                                <h4>Operation Details:</h4>
                                                <pre>{JSON.stringify(result.details, null, 2)}</pre>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </AuthGuard>
    );
};

export default AdminPage;
