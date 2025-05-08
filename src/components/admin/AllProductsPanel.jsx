import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, doc, updateDoc, orderBy, limit, startAfter, where, serverTimestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useNavigate } from 'react-router-dom';
import LoadingSpinner from '../LoadingSpinner';
import notificationService from '../../services/notificationService';
import '../../styles/admin/AllProductsPanel.css';

const AllProductsPanel = () => {
    const navigate = useNavigate();
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [lastVisible, setLastVisible] = useState(null);
    const [hasMore, setHasMore] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [selectedStatus, setSelectedStatus] = useState('all');
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [productToDelete, setProductToDelete] = useState(null);
    const [sortField, setSortField] = useState('createdAt');
    const [sortDirection, setSortDirection] = useState('desc');

    const PRODUCTS_PER_PAGE = 20;

    // Load products on component mount
    useEffect(() => {
        loadProducts();
    }, [selectedStatus, sortField, sortDirection]);

    // Load products function
    const loadProducts = async () => {
        setLoading(true);
        setError(null);

        try {
            let productsRef = collection(db, 'products');
            let productsQuery;

            // Apply status filter if not 'all'
            if (selectedStatus !== 'all') {
                productsQuery = query(
                    productsRef,
                    where('status', '==', selectedStatus),
                    orderBy(sortField, sortDirection),
                    limit(PRODUCTS_PER_PAGE)
                );
            } else {
                productsQuery = query(
                    productsRef,
                    orderBy(sortField, sortDirection),
                    limit(PRODUCTS_PER_PAGE)
                );
            }

            const snapshot = await getDocs(productsQuery);

            const productList = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Set last visible for pagination
            const lastDoc = snapshot.docs[snapshot.docs.length - 1];
            setLastVisible(lastDoc);

            // Check if there are more products
            setHasMore(productList.length === PRODUCTS_PER_PAGE);

            setProducts(productList);
        } catch (err) {
            console.error('Error loading products:', err);
            setError('Failed to load products. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    // Load more products
    const loadMoreProducts = async () => {
        if (!lastVisible || loadingMore) return;

        setLoadingMore(true);

        try {
            let productsRef = collection(db, 'products');
            let moreProductsQuery;

            // Apply status filter if not 'all'
            if (selectedStatus !== 'all') {
                moreProductsQuery = query(
                    productsRef,
                    where('status', '==', selectedStatus),
                    orderBy(sortField, sortDirection),
                    startAfter(lastVisible),
                    limit(PRODUCTS_PER_PAGE)
                );
            } else {
                moreProductsQuery = query(
                    productsRef,
                    orderBy(sortField, sortDirection),
                    startAfter(lastVisible),
                    limit(PRODUCTS_PER_PAGE)
                );
            }

            const snapshot = await getDocs(moreProductsQuery);

            const moreProducts = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Update last visible for pagination
            const lastDoc = snapshot.docs[snapshot.docs.length - 1];
            setLastVisible(lastDoc);

            // Check if there are more products
            setHasMore(moreProducts.length === PRODUCTS_PER_PAGE);

            // Add new products to the list
            setProducts(prevProducts => [...prevProducts, ...moreProducts]);
        } catch (err) {
            console.error('Error loading more products:', err);
            setError('Failed to load more products. Please try again.');
        } finally {
            setLoadingMore(false);
        }
    };

    // Handle search
    const handleSearch = (e) => {
        e.preventDefault();

        if (!searchTerm.trim()) {
            loadProducts();
            return;
        }

        setLoading(true);

        // Search through the products client-side (for simplicity)
        // Note: In a production app, you might want to use a server-side search solution
        const searchTermLower = searchTerm.toLowerCase();

        // Get all products first (without pagination)
        const fetchAllForSearch = async () => {
            try {
                const productsRef = collection(db, 'products');
                let searchQuery;

                if (selectedStatus !== 'all') {
                    searchQuery = query(
                        productsRef,
                        where('status', '==', selectedStatus)
                    );
                } else {
                    searchQuery = query(productsRef);
                }

                const snapshot = await getDocs(searchQuery);

                const allProducts = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));

                // Filter products based on search term
                const filteredProducts = allProducts.filter(product =>
                    product.name?.toLowerCase().includes(searchTermLower) ||
                    product.description?.toLowerCase().includes(searchTermLower) ||
                    product.category?.toLowerCase().includes(searchTermLower) ||
                    product.designerName?.toLowerCase().includes(searchTermLower)
                );

                setProducts(filteredProducts);
                setHasMore(false); // No pagination for search results
            } catch (err) {
                console.error('Error searching products:', err);
                setError('Failed to search products. Please try again.');
            } finally {
                setLoading(false);
            }
        };

        fetchAllForSearch();
    };

    // Handle status filter change
    const handleStatusChange = (e) => {
        setSelectedStatus(e.target.value);
    };

    // Handle sort change
    const handleSortChange = (field) => {
        if (sortField === field) {
            // If clicking the same field, toggle direction
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            // If clicking a new field, sort desc by default
            setSortField(field);
            setSortDirection('desc');
        }
    };

    // Navigate to edit product
    const handleEditProduct = (productId) => {
        navigate(`/product-edit/${productId}`);
    };

    // Open delete confirmation modal
    const openDeleteModal = (product) => {
        setProductToDelete(product);
        setDeleteModalOpen(true);
    };

    // Delete product
    const handleDeleteProduct = async () => {
        if (!productToDelete) return;

        try {
            // Use soft delete by updating status to 'deleted' rather than deleting document
            await updateDoc(doc(db, 'products', productToDelete.id), {
                status: 'deleted',
                updatedAt: serverTimestamp()
            });

            // Remove product from state
            setProducts(prevProducts =>
                prevProducts.filter(product => product.id !== productToDelete.id)
            );

            // Notify designer if available
            if (productToDelete.designerId) {
                await notificationService.createNotification({
                    userId: productToDelete.designerId,
                    title: "Product Deleted",
                    message: `Your product "${productToDelete.name}" has been deleted by an administrator.`,
                    type: "product_deleted",
                });
            }

            // Close modal and clear product to delete
            setDeleteModalOpen(false);
            setProductToDelete(null);
        } catch (err) {
            console.error('Error deleting product:', err);
            setError('Failed to delete product. Please try again.');
        }
    };

    // Format date
    const formatDate = (timestamp) => {
        if (!timestamp) return 'N/A';

        if (timestamp.toDate) {
            return timestamp.toDate().toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        }

        return new Date(timestamp).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    // Restore a deleted product
    const handleRestoreProduct = async (product) => {
        try {
            // Update the product status back to active
            await updateDoc(doc(db, 'products', product.id), {
                status: 'active',
                updatedAt: serverTimestamp()
            });

            // Update the product in the state
            setProducts(prevProducts =>
                prevProducts.map(p =>
                    p.id === product.id ? { ...p, status: 'active' } : p
                )
            );

            // Notify designer if available
            if (product.designerId) {
                await notificationService.createNotification({
                    userId: product.designerId,
                    title: "Product Restored",
                    message: `Your product "${product.name}" has been restored by an administrator and is now active.`,
                    type: "product_restored",
                });
            }

        } catch (err) {
            console.error('Error restoring product:', err);
            setError('Failed to restore product. Please try again.');
        }
    };

    // Format price as currency
    const formatPrice = (price) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(price || 0);
    };

    // Get the first available image URL from a product
    const getProductImage = (product) => {
        if (product.imageUrls && Array.isArray(product.imageUrls) && product.imageUrls.length > 0) {
            return product.imageUrls[0];
        }
        if (product.imageUrl) {
            return product.imageUrl;
        }
        return 'https://placehold.co/300x300?text=No+Image';
    };

    return (
        <div className="admin-panel all-products-panel">
            <div className="panel-header">
                <h3>All Products</h3>
                <div className="filters-row">
                    <div className="search-container">
                        <form onSubmit={handleSearch}>
                            <input
                                type="text"
                                placeholder="Search products..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                            <button type="submit" className="search-button">Search</button>
                        </form>
                    </div>

                    <div className="status-filter">
                        <label htmlFor="status-filter">Status:</label>
                        <select
                            id="status-filter"
                            value={selectedStatus}
                            onChange={handleStatusChange}
                        >
                            <option value="all">All</option>
                            <option value="active">Active</option>
                            <option value="pending">Pending</option>
                            <option value="archived">Archived</option>
                            <option value="rejected">Rejected</option>
                            <option value="deleted">Deleted</option>
                        </select>
                    </div>
                </div>

                {error && <div className="error-message">{error}</div>}
            </div>

            <div className="panel-content">
                {loading && !loadingMore ? (
                    <div className="loading-container">
                        <LoadingSpinner />
                        <p>Loading products...</p>
                    </div>
                ) : products.length === 0 ? (
                    <div className="no-items-message">
                        <p>No products found</p>
                    </div>
                ) : (
                    <>
                        <div className="products-table-container">
                            <table className="products-table">
                                <thead>
                                    <tr>
                                        <th className="image-column">Image</th>
                                        <th
                                            className={`sortable ${sortField === 'name' ? 'active-sort' : ''}`}
                                            onClick={() => handleSortChange('name')}
                                        >
                                            Name
                                            {sortField === 'name' && (
                                                <span className="sort-indicator">
                                                    {sortDirection === 'asc' ? '▲' : '▼'}
                                                </span>
                                            )}
                                        </th>
                                        <th
                                            className={`sortable ${sortField === 'price' ? 'active-sort' : ''}`}
                                            onClick={() => handleSortChange('price')}
                                        >
                                            Price
                                            {sortField === 'price' && (
                                                <span className="sort-indicator">
                                                    {sortDirection === 'asc' ? '▲' : '▼'}
                                                </span>
                                            )}
                                        </th>
                                        <th>Status</th>
                                        <th>Designer</th>
                                        <th
                                            className={`sortable ${sortField === 'createdAt' ? 'active-sort' : ''}`}
                                            onClick={() => handleSortChange('createdAt')}
                                        >
                                            Created
                                            {sortField === 'createdAt' && (
                                                <span className="sort-indicator">
                                                    {sortDirection === 'asc' ? '▲' : '▼'}
                                                </span>
                                            )}
                                        </th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {products.map(product => (
                                        <tr key={product.id}>
                                            <td className="image-column">
                                                <div className="product-thumbnail">
                                                    <img
                                                        src={getProductImage(product)}
                                                        alt={product.name}
                                                    />
                                                </div>
                                            </td>
                                            <td>
                                                <div className="product-name-cell">
                                                    <span className="product-name">{product.name}</span>
                                                    <span className="product-id">ID: {product.id}</span>
                                                </div>
                                            </td>
                                            <td>{formatPrice(product.price)}</td>
                                            <td>
                                                <span className={`status-badge ${product.status}`}>
                                                    {product.status}
                                                </span>
                                            </td>
                                            <td>{product.designerName || 'Unknown'}</td>
                                            <td>{formatDate(product.createdAt)}</td>
                                            <td>
                                                <div className="action-buttons">
                                                    <button
                                                        className="view-button"
                                                        onClick={() => navigate(`/product/${product.id}`)}
                                                        title="View Product"
                                                    >
                                                        View
                                                    </button>
                                                    <button
                                                        className="edit-button"
                                                        onClick={() => handleEditProduct(product.id)}
                                                        title="Edit Product"
                                                    >
                                                        Edit
                                                    </button>
                                                    {product.status === 'deleted' ? (
                                                        <button
                                                            className="restore-button"
                                                            onClick={() => handleRestoreProduct(product)}
                                                            title="Restore Product"
                                                        >
                                                            Restore
                                                        </button>
                                                    ) : (
                                                        <button
                                                            className="delete-button"
                                                            onClick={() => openDeleteModal(product)}
                                                            title="Delete Product"
                                                        >
                                                            Delete
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {hasMore && (
                            <div className="load-more-container">
                                <button
                                    className="load-more-button"
                                    onClick={loadMoreProducts}
                                    disabled={loadingMore}
                                >
                                    {loadingMore ? 'Loading...' : 'Load More Products'}
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Delete Confirmation Modal */}
            {deleteModalOpen && productToDelete && (
                <div className="modal-overlay">
                    <div className="delete-modal">
                        <h3>Delete Product</h3>
                        <p>Are you sure you want to delete <strong>{productToDelete.name}</strong>?</p>
                        <p className="warning-text">This action cannot be undone.</p>

                        <div className="modal-actions">
                            <button
                                className="delete-confirm-button"
                                onClick={handleDeleteProduct}
                            >
                                Delete
                            </button>
                            <button
                                className="cancel-button"
                                onClick={() => {
                                    setDeleteModalOpen(false);
                                    setProductToDelete(null);
                                }}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AllProductsPanel;