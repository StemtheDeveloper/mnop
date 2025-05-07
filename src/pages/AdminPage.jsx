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
import VerificationRequestsPanel from '../components/admin/VerificationRequestsPanel';
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

    const { currentUser, userRole, loading: userLoading, authInitialized } = useUser();
    const userContext = useUser();

    // Debug authentication state
    useEffect(() => {
        console.log("Authentication state in AdminPage:", {
            currentUser: currentUser ? { uid: currentUser.uid, email: currentUser.email } : null,
            userRole,
            loading: userLoading,
            authInitialized
        });
    }, [currentUser, userRole, userLoading, authInitialized]);

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
        if (userRole) {
            if (Array.isArray(userRole)) {
                setAdminRoles([...userRole]);
            } else {
                setAdminRoles([userRole]);
            }
        }
    }, [userRole]);

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
                            className={`tab-button ${activeTab === 'verifications' ? 'active' : ''}`}
                            onClick={() => setActiveTab('verifications')}
                        >
                            Verifications
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
                                                                    {Array.isArray(user.roles) ? user.roles.join(', ') : user.role || 'customer'}
                                                                </span>
                                                            </td>
                                                            <td>{user.createdAt ? new Date(user.createdAt.seconds * 1000).toLocaleDateString() : 'N/A'}</td>
                                                            <td className="action-cell">
                                                                <button
                                                                    className="admin-button small"
                                                                    onClick={() => console.log('Change Role')}
                                                                >
                                                                    Change Role
                                                                </button>
                                                                <button
                                                                    className="admin-button danger small"
                                                                    onClick={() => console.log('Delete User')}
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
                            </div>
                        )}

                        {activeTab === 'products' && (
                            <div className="products-tab">
                                <h2>Products Management</h2>
                                <AllProductsPanel />
                                <ProductApprovalPanel />
                                <TrendingProductsPanel />
                                <ProductArchivePanel />
                            </div>
                        )}

                        {activeTab === 'reviews' && (
                            <div className="reviews-tab">
                                <h2>Reviews Management</h2>
                                <div className="admin-section">
                                    <div className="admin-card">
                                        <h3>Review Moderation</h3>
                                        <p>Moderate product reviews submitted by users.</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'verifications' && (
                            <div className="verifications-tab">
                                <h2>Verification Requests</h2>
                                <VerificationRequestsPanel />
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
                                <AdminInvestmentSettings />
                            </div>
                        )}

                        {activeTab === 'database' && (
                            <div className="database-tab">
                                <h2>Database Management</h2>
                                <FirestoreIndexHelper />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </AuthGuard>
    );
};

export default AdminPage;
