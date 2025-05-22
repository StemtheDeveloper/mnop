import React, { useState, useEffect } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useUser } from '../context/UserContext';
import LoadingSpinner from '../components/LoadingSpinner';
import ManufacturerProductsList from '../components/manufacturer/ManufacturerProductsList';
import ManufacturerRequestsList from '../components/manufacturer/ManufacturerRequestsList';
import '../styles/ManufacturerDashboardPage.css';

const ManufacturerDashboardPage = () => {
    const { currentUser, userRole, isLoading: userLoading } = useUser();
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        totalProducts: 0,
        pendingApproval: 0,
        readyForPurchase: 0
    });
    const [activeTab, setActiveTab] = useState('products');

    const isManufacturer = Array.isArray(userRole)
        ? userRole.includes('manufacturer')
        : userRole === 'manufacturer';    // Redirect non-manufacturer users
    if (!userLoading && !isManufacturer) {
        return <Navigate to="/" replace />;
    }

    // Fetch manufacturer statistics
    useEffect(() => {
        const fetchStats = async () => {
            if (!currentUser?.uid) return;

            setLoading(true);
            try {
                // Query all products assigned to this manufacturer
                const productsQuery = query(
                    collection(db, 'products'),
                    where('manufacturerId', '==', currentUser.uid)
                );

                const productsSnapshot = await getDocs(productsQuery);
                const productsData = productsSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));

                // Calculate statistics
                const readyForPurchase = productsData.filter(p => p.readyForPurchase).length;
                const pendingProducts = productsData.filter(p =>
                    p.manufacturerFunded && !p.readyForPurchase
                ).length;

                // Get pending manufacturer requests count
                const requestsQuery = query(
                    collection(db, 'manufacturerRequests'),
                    where('manufacturerId', '==', currentUser.uid),
                    where('status', '==', 'pending')
                );
                const requestsSnapshot = await getDocs(requestsQuery);
                const pendingRequests = requestsSnapshot.size;

                setStats({
                    totalProducts: productsData.length,
                    pendingApproval: pendingProducts,
                    readyForPurchase: readyForPurchase,
                    pendingRequests: pendingRequests
                });
            } catch (error) {
                console.error('Error fetching manufacturer stats:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, [currentUser]);

    if (userLoading || loading) {
        return <LoadingSpinner />;
    }

    return (
        <div className="manufacturer-dashboard">
            <div className="dashboard-header">
                <h1>Manufacturer Dashboard</h1>
            </div>            <div className="stats-cards">
                <div className="stat-card">
                    <h3>Total Products</h3>
                    <div className="stat-value">{stats.totalProducts}</div>
                </div>
                <div className="stat-card highlight">
                    <h3>Pending Approval</h3>
                    <div className="stat-value">{stats.pendingApproval}</div>
                    <div className="stat-description">Products funded but not yet marked ready for purchase</div>
                </div>
                <div className="stat-card">
                    <h3>Ready For Purchase</h3>
                    <div className="stat-value">{stats.readyForPurchase}</div>
                </div>
                <div className="stat-card alert">
                    <h3>Pending Requests</h3>
                    <div className="stat-value">{stats.pendingRequests || 0}</div>
                    <div className="stat-description">Manufacturing requests awaiting your approval</div>
                </div>
            </div><div className="dashboard-tabs">
                <button
                    className={`tab-button ${activeTab === 'products' ? 'active' : ''}`}
                    onClick={() => setActiveTab('products')}
                >
                    Manage Products
                </button>
                <button
                    className={`tab-button ${activeTab === 'requests' ? 'active' : ''}`}
                    onClick={() => setActiveTab('requests')}
                >
                    Manufacturing Requests
                </button>
                <button
                    className={`tab-button ${activeTab === 'quotes' ? 'active' : ''}`}
                    onClick={() => setActiveTab('quotes')}
                >
                    Quote Requests
                </button>
            </div>

            <div className="tab-content">
                {activeTab === 'products' && (
                    <ManufacturerProductsList />
                )}

                {activeTab === 'requests' && (
                    <ManufacturerRequestsList />
                )}

                {activeTab === 'quotes' && (
                    <div className="quotes-section">
                        <p>Manage your quote requests and responses here.</p>
                        <Link to="/manufacturer/quotes" className="nav-link">
                            Go to Quote Management
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ManufacturerDashboardPage;
