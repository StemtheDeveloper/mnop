import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where, orderBy, limit, doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import '../../styles/admin/TrendingProductsPanel.css';

const TrendingProductsPanel = () => {
    const [trendingProducts, setTrendingProducts] = useState([]);
    const [extendedProducts, setExtendedProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('trending');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);

        try {
            // Load products that had deadline extensions
            const productsRef = collection(db, 'products');
            // Simplify the query to avoid composite index requirement
            const extendedQuery = query(
                productsRef,
                where('extensionHistory', '!=', null),
                limit(50)
            );

            const snapshot = await getDocs(extendedQuery);
            const extendedList = [];

            snapshot.forEach(doc => {
                const data = doc.data();
                if (data.extensionHistory && data.extensionHistory.length > 0) {
                    extendedList.push({
                        id: doc.id,
                        ...data,
                        lastExtensionDate: data.lastExtended?.toDate() || null
                    });
                }
            });

            // Sort client-side instead of using orderBy in the query
            extendedList.sort((a, b) => {
                // Sort by lastExtended date (newest first)
                const dateA = a.lastExtended?.toMillis() || 0;
                const dateB = b.lastExtended?.toMillis() || 0;
                return dateB - dateA;
            });

            setExtendedProducts(extendedList);

            // Get currently trending products based on recent views
            // For this we'll need to aggregate data from the productViews collection
            const now = new Date();
            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(now.getDate() - 7);

            const viewsRef = collection(db, 'productViews');
            const viewsQuery = query(
                viewsRef,
                where('timestamp', '>=', oneWeekAgo),
                limit(1000) // Limit to reasonable number for client-side processing
            );

            const viewsSnapshot = await getDocs(viewsQuery);

            // Count views per product
            const viewCounts = {};
            viewsSnapshot.forEach(doc => {
                const data = doc.data();
                const productId = data.productId;

                if (!viewCounts[productId]) {
                    viewCounts[productId] = 0;
                }
                viewCounts[productId]++;
            });

            // Get products with most views
            const productIds = Object.keys(viewCounts)
                .filter(id => viewCounts[id] >= 30) // Minimum threshold
                .sort((a, b) => viewCounts[b] - viewCounts[a])
                .slice(0, 20); // Get top 20

            if (productIds.length > 0) {
                // Fetch product details for these IDs
                const trendingProductsList = [];

                for (const id of productIds) {
                    const productDoc = await getDoc(doc(db, 'products', id));
                    if (productDoc.exists()) {
                        trendingProductsList.push({
                            id,
                            ...productDoc.data(),
                            viewCount: viewCounts[id]
                        });
                    }
                }

                setTrendingProducts(trendingProductsList);
            }
        } catch (error) {
            console.error('Error loading trending products data:', error);
        } finally {
            setLoading(false);
        }
    };

    // Format date for display
    const formatDate = (date) => {
        if (!date) return 'N/A';
        return new Date(date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    return (
        <div className="trending-products-panel">
            <h2>Trending Products Management</h2>

            <div className="tabs">
                <button
                    className={`tab-button ${activeTab === 'trending' ? 'active' : ''}`}
                    onClick={() => setActiveTab('trending')}
                >
                    Trending Products
                </button>
                <button
                    className={`tab-button ${activeTab === 'extended' ? 'active' : ''}`}
                    onClick={() => setActiveTab('extended')}
                >
                    Extended Products
                </button>
            </div>

            <div className="tab-content">
                {loading ? (
                    <div className="loading-message">
                        Loading products data...
                    </div>
                ) : (
                    <>
                        {activeTab === 'trending' && (
                            <div className="trending-products-list">
                                <h3>Currently Trending Products</h3>

                                {trendingProducts.length === 0 ? (
                                    <p className="empty-message">No trending products found</p>
                                ) : (
                                    <table className="products-table">
                                        <thead>
                                            <tr>
                                                <th>Product Name</th>
                                                <th>Designer</th>
                                                <th>Views (7d)</th>
                                                <th>Deadline</th>
                                                <th>Funding</th>
                                                <th>Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {trendingProducts.map(product => (
                                                <tr key={product.id}>
                                                    <td>
                                                        <a href={`/products/${product.id}`} target="_blank" rel="noopener noreferrer">
                                                            {product.name}
                                                        </a>
                                                    </td>
                                                    <td>{product.designerName || product.designerId}</td>
                                                    <td>{product.viewCount}</td>
                                                    <td>{formatDate(product.deadline?.toDate())}</td>
                                                    <td>
                                                        ${product.currentFunding || 0} / ${product.fundingGoal || 0}
                                                        <div className="funding-bar">
                                                            <div
                                                                className="funding-progress"
                                                                style={{
                                                                    width: `${Math.min(
                                                                        ((product.currentFunding || 0) / (product.fundingGoal || 1)) * 100,
                                                                        100
                                                                    )}%`
                                                                }}
                                                            ></div>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <span className={`status-badge ${product.status}`}>
                                                            {product.status}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        )}

                        {activeTab === 'extended' && (
                            <div className="extended-products-list">
                                <h3>Products with Extended Deadlines</h3>

                                {extendedProducts.length === 0 ? (
                                    <p className="empty-message">No products with deadline extensions found</p>
                                ) : (
                                    <table className="products-table">
                                        <thead>
                                            <tr>
                                                <th>Product Name</th>
                                                <th>Designer</th>
                                                <th>Last Extension</th>
                                                <th>Current Deadline</th>
                                                <th>Extensions</th>
                                                <th>Funding</th>
                                                <th>Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {extendedProducts.map(product => (
                                                <tr key={product.id}>
                                                    <td>
                                                        <a href={`/products/${product.id}`} target="_blank" rel="noopener noreferrer">
                                                            {product.name}
                                                        </a>
                                                    </td>
                                                    <td>{product.designerName || product.designerId}</td>
                                                    <td>{formatDate(product.lastExtensionDate)}</td>
                                                    <td>{formatDate(product.deadline?.toDate())}</td>
                                                    <td>{product.extensionHistory?.length || 0}</td>
                                                    <td>
                                                        ${product.currentFunding || 0} / ${product.fundingGoal || 0}
                                                        <div className="funding-bar">
                                                            <div
                                                                className="funding-progress"
                                                                style={{
                                                                    width: `${Math.min(
                                                                        ((product.currentFunding || 0) / (product.fundingGoal || 1)) * 100,
                                                                        100
                                                                    )}%`
                                                                }}
                                                            ></div>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <span className={`status-badge ${product.status}`}>
                                                            {product.status}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}

                                <div className="extension-metrics">
                                    <div className="metric-card">
                                        <div className="metric-value">{extendedProducts.length}</div>
                                        <div className="metric-label">Total Extended Products</div>
                                    </div>
                                    <div className="metric-card">
                                        <div className="metric-value">
                                            {extendedProducts.filter(p => p.status === 'active').length}
                                        </div>
                                        <div className="metric-label">Active Extended Products</div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            <div className="trending-info">
                <h4>About Product Extensions</h4>
                <p>
                    Products can receive automatic deadline extensions if they're trending with high views or investment activity.
                    Designers can also manually request one extension per product if it qualifies as trending.
                </p>
            </div>
        </div>
    );
};

export default TrendingProductsPanel;
