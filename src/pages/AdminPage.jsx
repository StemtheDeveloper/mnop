import React, { useState } from 'react';
import { useUser } from '../context/UserContext';
import { Navigate } from 'react-router-dom';
import AchievementsManagementPanel from '../components/admin/AchievementsManagementPanel';
import '../styles/AdminPage.css';

const AdminPage = () => {
    const { currentUser, userRole, hasRole } = useUser();
    const [activeTab, setActiveTab] = useState('achievements');

    // Check if the user is an admin
    const isAdmin = hasRole('admin');

    // Redirect if not admin
    if (!currentUser) {
        return <Navigate to="/login" />;
    }

    if (!isAdmin) {
        return <Navigate to="/unauthorized" />;
    }

    // Admin dashboard tabs
    const tabs = [
        { id: 'dashboard', label: 'Dashboard', icon: '📊' },
        { id: 'achievements', label: 'Achievements', icon: '🏆' },
        { id: 'users', label: 'Users', icon: '👥' },
        { id: 'products', label: 'Products', icon: '📦' },
        { id: 'settings', label: 'Settings', icon: '⚙️' }
    ];

    return (
        <div className="admin-page">
            <div className="admin-container">
                <div className="admin-sidebar">
                    <div className="admin-sidebar-header">
                        <h2>Admin Panel</h2>
                    </div>
                    <nav className="admin-nav">
                        <ul>
                            {tabs.map(tab => (
                                <li key={tab.id}>
                                    <button
                                        className={`admin-nav-item ${activeTab === tab.id ? 'active' : ''}`}
                                        onClick={() => setActiveTab(tab.id)}
                                    >
                                        <span className="admin-nav-icon">{tab.icon}</span>
                                        <span className="admin-nav-label">{tab.label}</span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </nav>
                </div>

                <div className="admin-content">
                    <div className="admin-header">
                        <h1>
                            {tabs.find(tab => tab.id === activeTab)?.label || 'Admin Dashboard'}
                        </h1>
                    </div>

                    <div className="admin-panel">
                        {activeTab === 'achievements' && (
                            <AchievementsManagementPanel />
                        )}

                        {activeTab === 'dashboard' && (
                            <div className="admin-placeholder">
                                <h2>Dashboard Overview</h2>
                                <p>Admin dashboard statistics and overview will appear here.</p>
                            </div>
                        )}

                        {activeTab === 'users' && (
                            <div className="admin-placeholder">
                                <h2>User Management</h2>
                                <p>User management tools will appear here.</p>
                            </div>
                        )}

                        {activeTab === 'products' && (
                            <div className="admin-placeholder">
                                <h2>Product Management</h2>
                                <p>Product management tools will appear here.</p>
                            </div>
                        )}

                        {activeTab === 'settings' && (
                            <div className="admin-placeholder">
                                <h2>Admin Settings</h2>
                                <p>Admin configuration settings will appear here.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminPage;
