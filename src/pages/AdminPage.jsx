import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, updateDoc, writeBatch, deleteDoc, query, orderBy, limit, startAfter } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useUser } from '../context/UserContext';
import AuthGuard from '../components/AuthGuard';
import LoadingSpinner from '../components/LoadingSpinner';
import InterestRateAdminPanel from '../components/admin/InterestRateAdminPanel';
import MarketRatesPanel from '../components/admin/MarketRatesPanel';
import ProductArchivePanel from '../components/admin/ProductArchivePanel';
import TrendingProductsPanel from '../components/admin/TrendingProductsPanel';
import '../styles/AdminTools.css';

const AdminPage = () => {
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState({ success: false, message: '', details: null });
    const [operation, setOperation] = useState('');
    const { currentUser } = useUser();
    const [activeTab, setActiveTab] = useState('users');

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
            const userRef = doc(db, 'users', selectedUser.id);

            // Get current roles
            const currentRoles = Array.isArray(selectedUser.roles)
                ? [...selectedUser.roles]
                : [selectedUser.role || 'customer'];

            // Add the new role if it doesn't exist
            if (!currentRoles.includes(newRole)) {
                currentRoles.push(newRole);
            }

            // Update Firestore
            await updateDoc(userRef, {
                roles: currentRoles,
                role: newRole, // Update old field for backward compatibility
                updatedAt: new Date()
            });

            // Update local state
            setUsers(prevUsers => prevUsers.map(user =>
                user.id === selectedUser.id
                    ? { ...user, roles: currentRoles, role: newRole }
                    : user
            ));

            setResult({
                success: true,
                message: `Updated ${selectedUser.email} with role: ${newRole}`,
                details: null
            });

            // Close modal
            setRoleModalOpen(false);
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
                                <TrendingProductsPanel />
                                <ProductArchivePanel />
                                {/* Other product management components */}
                            </div>
                        )}

                        {activeTab === 'finance' && (
                            <div className="finance-tab">
                                <h2>Financial Management</h2>

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
                    </div>
                </div>
            </div>
        </AuthGuard>
    );
};

export default AdminPage;
