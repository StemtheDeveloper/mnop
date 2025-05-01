import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, updateDoc, writeBatch, deleteDoc, query, orderBy, limit, startAfter, getDoc, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useUser } from '../context/UserContext';
import AuthGuard from '../components/AuthGuard';
import LoadingSpinner from '../components/LoadingSpinner';
import InterestRateAdminPanel from '../components/admin/InterestRateAdminPanel';
import MarketRatesPanel from '../components/admin/MarketRatesPanel';
import ProductArchivePanel from '../components/admin/ProductArchivePanel';
import TrendingProductsPanel from '../components/admin/TrendingProductsPanel';
import ProductApprovalPanel from '../components/admin/ProductApprovalPanel';
import AllProductsPanel from '../components/admin/AllProductsPanel';
import PaymentSettingsPanel from '../components/admin/PaymentSettingsPanel';
import BusinessAccountPanel from '../components/admin/BusinessAccountPanel';
import FirestoreIndexHelper from '../components/admin/FirestoreIndexHelper';
import NopsManagementPanel from '../components/admin/NopsManagementPanel';
import AchievementsManagementPanel from '../components/admin/AchievementsManagementPanel';
import AdminInvestmentSettings from '../components/admin/AdminInvestmentSettings';
import RefundManagementPanel from '../components/admin/RefundManagementPanel';
import CurrencyManagementPanel from '../components/admin/CurrencyManagementPanel';
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
    const [conversationIndexStatus, setConversationIndexStatus] = useState({ loading: false, message: '', type: '' });

    const { currentUser, userRole, userRoles, loading: userLoading, authInitialized, hasRole } = useUser();
    const userContext = useUser();

    // Debug authentication state
    useEffect(() => {
        console.log("Authentication state in AdminPage:", {
            currentUser: currentUser ? { uid: currentUser.uid, email: currentUser.email } : null,
            userRole,
            userRoles,
            loading: userLoading,
            authInitialized
        });
    }, [currentUser, userRole, userRoles, userLoading, authInitialized]);

    const [activeTab, setActiveTab] = useState(initialActiveTab || 'users');

    const [adminRoles, setAdminRoles] = useState([]);
    const [selfRoleLoading, setSelfRoleLoading] = useState(false);
    const [selfRoleMessage, setSelfRoleMessage] = useState({ type: '', text: '' });

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

    const USER_ROLES = ['customer', 'designer', 'manufacturer', 'investor', 'admin'];
    const USERS_PER_PAGE = 20;

    useEffect(() => {
        if (userRoles) {
            setAdminRoles([...userRoles]);
        }
    }, [userRoles]);

    const addRoleDirectly = async (userId, roleId) => {
        try {
            const userRef = doc(db, 'users', userId);
            const userSnap = await getDoc(userRef);

            if (!userSnap.exists()) {
                throw new Error('User document not found');
            }

            const userData = userSnap.data();

            let currentRoles = [];
            if (Array.isArray(userData.roles)) {
                currentRoles = [...userData.roles];
            } else if (userData.role) {
                currentRoles = [userData.role];
            } else {
                currentRoles = ['customer'];
            }

            if (!currentRoles.includes(roleId)) {
                currentRoles.push(roleId);

                await updateDoc(userRef, {
                    roles: currentRoles,
                    role: roleId,
                    updatedAt: new Date()
                });

                return true;
            }

            return false;
        } catch (error) {
            console.error('Error adding role:', error);
            throw error;
        }
    };

    const removeRoleDirectly = async (userId, roleId) => {
        try {
            const userRef = doc(db, 'users', userId);
            const userSnap = await getDoc(userRef);

            if (!userSnap.exists()) {
                throw new Error('User document not found');
            }

            const userData = userSnap.data();

            let currentRoles = [];
            if (Array.isArray(userData.roles)) {
                currentRoles = [...userData.roles];
            } else if (userData.role) {
                currentRoles = [userData.role];
            } else {
                return false;
            }

            if (currentRoles.includes(roleId)) {
                const newRoles = currentRoles.filter(role => role !== roleId);

                if (newRoles.length === 0) {
                    newRoles.push('customer');
                }

                await updateDoc(userRef, {
                    roles: newRoles,
                    role: newRoles[0],
                    updatedAt: new Date()
                });

                return true;
            }

            return false;
        } catch (error) {
            console.error('Error removing role:', error);
            throw error;
        }
    };

    const removeRoleFromUser = async (userId, roleId) => {
        if (!userId || !roleId) return false;

        setLoading(true);
        setResult({ success: false, message: 'Removing user role...', details: null });

        try {
            const success = await removeRoleDirectly(userId, roleId);

            if (success) {
                // Update the local user data
                const userRef = doc(db, 'users', userId);
                const userSnap = await getDoc(userRef);
                const userData = userSnap.data();

                // Update the user in the users list
                setUsers(prevUsers => prevUsers.map(user =>
                    user.id === userId
                        ? {
                            ...user,
                            roles: userData.roles,
                            role: userData.role
                        }
                        : user
                ));

                setResult({
                    success: true,
                    message: `Removed ${roleId} role from ${userData.email || 'user'}`,
                    details: null
                });
                return true;
            } else {
                setResult({
                    success: false,
                    message: `User doesn't have the ${roleId} role`,
                    details: null
                });
                return false;
            }
        } catch (error) {
            console.error('Error removing user role:', error);
            setResult({
                success: false,
                message: `Failed to remove role: ${error.message}`,
                details: null
            });
            return false;
        } finally {
            setLoading(false);
        }
    };

    const handleAddSelfRole = async (roleId) => {
        if (!currentUser || adminRoles.includes(roleId)) return;

        setSelfRoleLoading(true);
        setSelfRoleMessage({ type: '', text: '' });

        try {
            const success = await addRoleDirectly(currentUser.uid, roleId);

            if (success) {
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

    const handleRemoveSelfRole = async (roleId) => {
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
            const success = await removeRoleDirectly(currentUser.uid, roleId);

            if (success) {
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

    const debugUserContext = () => {
        console.log("Available methods in UserContext:",
            Object.keys(userContext).filter(key => typeof userContext[key] === 'function'));
        setSelfRoleMessage({
            type: 'info',
            text: 'Available methods logged to console. Check browser developer tools.'
        });
    };

    useEffect(() => {
        fetchUsers();
    }, []);

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

            const lastVisible = snapshot.docs[snapshot.docs.length - 1];
            setLastVisible(lastVisible);

            setHasMoreUsers(snapshot.docs.length === USERS_PER_PAGE);

            const userList = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            if (loadMore) {
                setUsers(prevUsers => [...prevUsers, ...userList]);
            } else {
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

    const loadMoreUsers = () => {
        if (hasMoreUsers && !loadingUsers) {
            fetchUsers(true);
        }
    };

    const openRoleModal = (user) => {
        setSelectedUser(user);
        setNewRole('');
        setRoleModalOpen(true);
    };

    const openDeleteModal = (user) => {
        setSelectedUser(user);
        setConfirmDelete('');
        setDeleteModalOpen(true);
    };

    const updateUserRole = async () => {
        if (!selectedUser || !newRole) return;

        setLoading(true);
        setResult({ success: false, message: 'Updating user role...', details: null });

        try {
            const success = await addRoleDirectly(selectedUser.id, newRole);

            if (success) {
                const userRef = doc(db, 'users', selectedUser.id);
                const userSnap = await getDoc(userRef);
                const userData = userSnap.data();

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

    const deleteUserAccount = async () => {
        if (!selectedUser) return;

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
            await deleteDoc(doc(db, 'users', selectedUser.id));

            setUsers(prevUsers => prevUsers.filter(user => user.id !== selectedUser.id));

            setResult({
                success: true,
                message: `Successfully deleted user: ${selectedUser.email}`,
                details: null
            });

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

    const formatRoleDisplay = (user) => {
        if (Array.isArray(user.roles)) {
            return user.roles.join(', ');
        } else if (user.role) {
            return user.role;
        }
        return 'customer';
    };

    const updateRoleStructure = async () => {
        setLoading(true);
        setResult({ success: false, message: 'Processing...', details: null });
        setOperation('role-migration');

        try {
            const usersRef = collection(db, 'users');
            const snapshot = await getDocs(usersRef);

            const batch = writeBatch(db);
            let updatedCount = 0;
            let skippedCount = 0;
            let errorCount = 0;
            const errors = [];

            snapshot.forEach((document) => {
                const userData = document.data();

                if (userData.role && !userData.roles) {
                    const userRef = doc(db, 'users', document.id);
                    batch.update(userRef, {
                        roles: [userData.role],
                        rolesMigrated: true,
                        lastUpdated: new Date()
                    });
                    updatedCount++;
                } else if (userData.roles) {
                    skippedCount++;
                } else if (!userData.role && !userData.roles) {
                    const userRef = doc(db, 'users', document.id);
                    batch.update(userRef, {
                        roles: ['user'],
                        role: 'user',
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

    const handleCheckConversationIndex = async () => {
        setConversationIndexStatus({ loading: true, message: 'Checking conversation index...', type: 'info' });

        const conversationsRef = collection(db, 'conversations');
        const q = query(
            conversationsRef,
            where('participants', 'array-contains', currentUser?.uid || 'test-user-id'),
            orderBy('lastMessageAt', 'desc'),
            limit(1)
        );

        try {
            await getDocs(q);
            setConversationIndexStatus({
                loading: false,
                message: 'Conversation query successful. The required index likely exists or is not needed for current data.',
                type: 'success'
            });
        } catch (error) {
            console.error("Error checking conversation index:", error);
            if (error.code === 'failed-precondition' && error.message.includes('index')) {
                const indexCreationUrl = `https://console.firebase.google.com/v1/r/project/${db.app.options.projectId}/firestore/indexes?create_composite=ClFwcm9qZWN0cy9tLW5vcC0zOWIyZi9kYXRhYmFzZXMvKGRlZmF1bHQpL2NvbGxlY3Rpb25Hcm91cHMvY29udmVyc2F0aW9ucy9pbmRleGVzL18QARoQCgxwYXJ0aWNpcGFudHMYARoRCg1sYXN0TWVzc2FnZUF0EAIaDAoIX19uYW1lX18QAg`;
                setConversationIndexStatus({
                    loading: false,
                    message: (
                        <>
                            The required Firestore index for conversations is missing.
                            This index allows efficiently querying conversations by participant and sorting by the last message time.
                            <br />
                            <a href={indexCreationUrl} target="_blank" rel="noopener noreferrer" className="admin-link">
                                Click here to create the index in the Firebase Console.
                            </a>
                            <br />
                            (Index details: Collection='conversations', Fields: participants ASC, lastMessageAt DESC)
                        </>
                    ),
                    type: 'error'
                });
            } else {
                setConversationIndexStatus({
                    loading: false,
                    message: `An error occurred while checking the index: ${error.message}`,
                    type: 'error'
                });
            }
        }
    };

    return (
        <AuthGuard allowedRoles="admin">
            <div className="admin-page">
                <div className="admin-container">
                    <h1>Admin Dashboard</h1>

                    <div className="admin-section admin-self-role-section">
                        <h2>Your Account Roles</h2>

                        {selfRoleMessage.text && (
                            <div className={`message ${selfRoleMessage.type}`}>
                                {selfRoleMessage.text}
                            </div>
                        )}

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
                            className={`tab-button ${activeTab === 'reviews' ? 'active' : ''}`}
                            onClick={() => setActiveTab('reviews')}
                        >
                            Reviews
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
                                            <LoadingSpinner size="medium" showText={true} text="Loading users..." />
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

                                {roleModalOpen && selectedUser && (
                                    <div className="modal-overlay">
                                        <div className="modal-container">
                                            <h2>Manage User Roles</h2>
                                            <div className="modal-content">
                                                <p><strong>User:</strong> {selectedUser.email}</p>

                                                <div className="current-roles-section">
                                                    <h3>Current Roles</h3>
                                                    {Array.isArray(selectedUser.roles) && selectedUser.roles.length > 0 ? (
                                                        <ul className="user-roles-list">
                                                            {selectedUser.roles.map((role) => (
                                                                <li key={role} className="user-role-item">
                                                                    <span className={`role-badge ${role}`}>{role}</span>
                                                                    <button
                                                                        onClick={() => removeRoleFromUser(selectedUser.id, role)}
                                                                        disabled={loading || selectedUser.roles.length === 1}
                                                                        className="role-action-button remove-button"
                                                                        title={selectedUser.roles.length === 1 ? "Users must have at least one role" : "Remove this role"}
                                                                    >
                                                                        Remove
                                                                    </button>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    ) : selectedUser.role ? (
                                                        <ul className="user-roles-list">
                                                            <li className="user-role-item">
                                                                <span className={`role-badge ${selectedUser.role}`}>{selectedUser.role}</span>
                                                                <button
                                                                    disabled={true}
                                                                    className="role-action-button remove-button"
                                                                    title="Users must have at least one role"
                                                                >
                                                                    Remove
                                                                </button>
                                                            </li>
                                                        </ul>
                                                    ) : (
                                                        <p>No roles assigned. This is unusual - adding a default role is recommended.</p>
                                                    )}
                                                </div>

                                                <div className="form-group">
                                                    <label htmlFor="newRole">Add New Role:</label>
                                                    <select
                                                        id="newRole"
                                                        value={newRole}
                                                        onChange={(e) => setNewRole(e.target.value)}
                                                    >
                                                        <option value="">Select a role</option>
                                                        {USER_ROLES.filter(role => {
                                                            // Filter out roles the user already has
                                                            if (Array.isArray(selectedUser.roles)) {
                                                                return !selectedUser.roles.includes(role);
                                                            } else if (selectedUser.role) {
                                                                return selectedUser.role !== role;
                                                            }
                                                            return true;
                                                        }).map(role => (
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
                                                        {loading ? 'Updating...' : 'Add Role'}
                                                    </button>
                                                    <button
                                                        className="admin-button secondary"
                                                        onClick={() => setRoleModalOpen(false)}
                                                        disabled={loading}
                                                    >
                                                        Close
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

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
                                <AllProductsPanel />
                                <ProductApprovalPanel />
                                <TrendingProductsPanel />
                                <ProductArchivePanel />

                                <div className="admin-section">
                                    <div className="admin-card">
                                        <h3>Inventory Alerts & Reordering</h3>
                                        <p>
                                            Manage low stock alerts and automated reordering settings. View products that are running low on inventory and configure automatic purchase orders.
                                        </p>
                                        <a href="/admin/inventory-alerts" className="admin-button">
                                            Open Inventory Alerts Panel
                                        </a>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'reviews' && (
                            <div className="reviews-tab">
                                <h2>Reviews Management</h2>

                                <div className="admin-section">
                                    <div className="admin-card">
                                        <h3>Review Moderation</h3>
                                        <p>
                                            Moderate product reviews submitted by users. Approve, reject, or delete pending reviews to maintain high-quality content on the platform.
                                        </p>
                                        <a href="/admin/review-moderation" className="admin-button">
                                            Open Review Moderation Panel
                                        </a>
                                    </div>

                                    <div className="admin-card">
                                        <h3>User Feedback</h3>
                                        <p>
                                            View and manage user feedback submitted through the feedback pop-out bar. Analyze user suggestions and experience reports to improve the platform.
                                        </p>
                                        <a href="/admin/feedback" className="admin-button">
                                            Open Feedback Management
                                        </a>
                                    </div>

                                    <div className="admin-card">
                                        <h3>Review Guidelines</h3>
                                        <p>
                                            Our review guidelines help maintain a respectful and productive community. Reviews should:
                                        </p>
                                        <ul className="guidelines-list">
                                            <li>Be honest and authentic about experiences with products</li>
                                            <li>Focus on product features, quality, and usability</li>
                                            <li>Avoid offensive language, hate speech, or personal attacks</li>
                                            <li>Provide constructive feedback that helps others make informed decisions</li>
                                        </ul>
                                    </div>

                                    <div className="admin-card">
                                        <h3>Common Reasons for Review Rejection</h3>
                                        <ul className="guidelines-list">
                                            <li><strong>Spam or promotional content:</strong> Reviews that promote other products or contain spam</li>
                                            <li><strong>Offensive content:</strong> Reviews with inappropriate language or personal attacks</li>
                                            <li><strong>Off-topic:</strong> Reviews that don't address the product's qualities or performance</li>
                                            <li><strong>Conflicts of interest:</strong> Reviews by competitors or individuals with vested interests</li>
                                        </ul>
                                    </div>
                                </div>
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
                            </div>
                        )}

                        {activeTab === 'finance' && (
                            <div className="finance-tab">
                                <h2>Financial Management</h2>

                                <BusinessAccountPanel />
                                <PaymentSettingsPanel />
                                <RefundManagementPanel />
                                <CurrencyManagementPanel />
                                <MarketRatesPanel />
                                <InterestRateAdminPanel />
                            </div>
                        )}

                        {activeTab === 'settings' && (
                            <div className="settings-tab">
                                <h2>Platform Settings</h2>

                                <div className="settings-tab-navigation">
                                    <div className="settings-categories">
                                        <div className="settings-category active">
                                            Investment Settings
                                        </div>
                                        <div className="settings-category">
                                            Platform Settings
                                        </div>
                                    </div>
                                </div>

                                <div className="settings-content">
                                    <AdminInvestmentSettings />
                                </div>
                            </div>
                        )}

                        {activeTab === 'database' && (
                            <div className="database-tab">
                                <h2>Database Management</h2>
                                <FirestoreIndexHelper />

                                <div className="admin-section">
                                    <h2>Index Management</h2>
                                    <div className="admin-card">
                                        <h3>Conversation Query Index</h3>
                                        <p>
                                            Checks if the necessary Firestore index exists for efficiently querying user conversations
                                            (filtering by 'participants' and ordering by 'lastMessageAt').
                                        </p>
                                        <button
                                            className="admin-button"
                                            onClick={handleCheckConversationIndex}
                                            disabled={conversationIndexStatus.loading}
                                        >
                                            {conversationIndexStatus.loading ? 'Checking...' : 'Check Conversation Index'}
                                        </button>
                                        {conversationIndexStatus.message && (
                                            <div className={`message ${conversationIndexStatus.type} index-status`}>
                                                {conversationIndexStatus.message}
                                            </div>
                                        )}
                                    </div>
                                </div>

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

                                    <div className="admin-card">
                                        <h3>Product Category Data Fixer</h3>
                                        <p>
                                            Fix product category data issues. Use this tool to ensure all products have proper
                                            category fields in the correct format (arrays).
                                        </p>
                                        <a href="/admin/data-fixer" className="admin-button">
                                            Open Data Fixer Tool
                                        </a>
                                    </div>

                                    <div className="admin-card">
                                        <h3>Product Data CSV Export/Import</h3>
                                        <p>
                                            Export products data to CSV for bulk editing in Excel (including manufacturing costs),
                                            then import the modified data back to update product information.
                                        </p>
                                        <div className="csv-actions">
                                            <a href="/admin/products-csv-export" className="admin-button">
                                                Export Products to CSV
                                            </a>
                                            <a href="/admin/products-csv-import" className="admin-button">
                                                Import Products from CSV
                                            </a>
                                        </div>
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
