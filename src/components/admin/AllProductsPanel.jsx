import React, { useState, useEffect, useRef } from 'react';
import {
    collection,
    query,
    getDocs,
    doc,
    updateDoc,
    orderBy,
    limit,
    startAfter,
    where,
    serverTimestamp,
    writeBatch,
    addDoc,
    getDoc,
    deleteDoc
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useNavigate } from 'react-router-dom';
import LoadingSpinner from '../LoadingSpinner';
import notificationService from '../../services/notificationService';
import '../../styles/admin/AllProductsPanel.css';
import Papa from 'papaparse'; // For CSV parsing

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

    // New state variables for enhanced functionality
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [editingProduct, setEditingProduct] = useState(null);
    const [editField, setEditField] = useState(null);
    const [editValue, setEditValue] = useState('');
    const [selectedProducts, setSelectedProducts] = useState([]);
    const [selectAll, setSelectAll] = useState(false);
    const [bulkActionModalOpen, setBulkActionModalOpen] = useState(false);
    const [bulkAction, setBulkAction] = useState('');
    const [importModalOpen, setImportModalOpen] = useState(false);
    const [importData, setImportData] = useState(null);
    const [importFormat, setImportFormat] = useState('csv');
    const [importPreview, setImportPreview] = useState([]);
    const [showPreview, setShowPreview] = useState(false);
    const [previewProduct, setPreviewProduct] = useState(null);
    const [dataHealth, setDataHealth] = useState({});
    const [saveSuccess, setSaveSuccess] = useState(false);

    const fileInputRef = useRef(null);
    const csvExportRef = useRef(null);
    const jsonExportRef = useRef(null);

    // Constants
    const PRODUCTS_PER_PAGE = pageSize;

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

    // Data health check functions
    const checkDataHealth = (product) => {
        const health = {
            overall: 'good', // Can be 'good', 'warning', or 'bad'
            fields: {
                name: product.name ? 'good' : 'bad',
                category: product.category ? 'good' : 'bad',
                price: typeof product.price === 'number' && product.price > 0 ? 'good' : 'bad',
                description: product.description && product.description.length > 20 ? 'good' : product.description ? 'warning' : 'bad',
                images: (product.imageUrls && product.imageUrls.length > 0) || product.imageUrl ? 'good' : 'bad',
                status: ['active', 'pending', 'rejected', 'archived', 'deleted'].includes(product.status) ? 'good' : 'bad',
            }
        };

        // Determine overall health
        const fieldValues = Object.values(health.fields);
        if (fieldValues.includes('bad')) {
            health.overall = 'bad';
        } else if (fieldValues.includes('warning')) {
            health.overall = 'warning';
        }

        return health;
    };

    // Check all products' health
    useEffect(() => {
        if (products.length > 0) {
            const healthData = {};
            products.forEach(product => {
                healthData[product.id] = checkDataHealth(product);
            });
            setDataHealth(healthData);
        }
    }, [products]);

    // Export functions
    const exportToCSV = () => {
        // Export all products if none selected, otherwise just selected
        const productsToExport = selectedProducts.length > 0
            ? products.filter(p => selectedProducts.includes(p.id))
            : products;

        // Convert to CSV format
        const productData = productsToExport.map(p => {
            // Handle nested data and prepare for CSV export
            return {
                id: p.id,
                name: p.name || '',
                description: p.description || '',
                category: p.category || '',
                price: p.price || 0,
                status: p.status || '',
                designerName: p.designerName || '',
                designerId: p.designerId || '',
                imageUrl: Array.isArray(p.imageUrls) ? p.imageUrls.join(';') : p.imageUrl || '',
                createdAt: p.createdAt ? (p.createdAt.toDate ? p.createdAt.toDate().toISOString() : p.createdAt) : ''
            };
        });

        const csv = Papa.unparse(productData);

        // Create download link
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `products-export-${Date.now()}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const exportToJSON = () => {
        // Export all products if none selected, otherwise just selected
        const productsToExport = selectedProducts.length > 0
            ? products.filter(p => selectedProducts.includes(p.id))
            : products;

        // Convert timestamps to strings so they stringify properly
        const processedProducts = productsToExport.map(p => {
            const processed = { ...p };
            if (processed.createdAt && processed.createdAt.toDate) {
                processed.createdAt = processed.createdAt.toDate().toISOString();
            }
            if (processed.updatedAt && processed.updatedAt.toDate) {
                processed.updatedAt = processed.updatedAt.toDate().toISOString();
            }
            return processed;
        });

        // Create download link
        const json = JSON.stringify(processedProducts, null, 2);
        const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `products-export-${Date.now()}.json`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Import functions
    const handleImportClick = () => {
        setImportModalOpen(true);
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();

        reader.onload = (event) => {
            try {
                let parsedData;

                if (importFormat === 'csv') {
                    const result = Papa.parse(event.target.result, { header: true });
                    parsedData = result.data;
                } else {
                    parsedData = JSON.parse(event.target.result);
                }

                setImportData(parsedData);
                // Generate preview of first 5 items
                setImportPreview(parsedData.slice(0, 5));
            } catch (err) {
                console.error('Error parsing file:', err);
                setError('Failed to parse file. Please check the format and try again.');
            }
        };

        if (importFormat === 'csv') {
            reader.readAsText(file);
        } else {
            reader.readAsText(file);
        }
    };

    const importProducts = async () => {
        if (!Array.isArray(importData) || importData.length === 0) return;

        setLoading(true);
        setError(null);

        const PRODUCTS_COLLECTION = collection(db, 'products');
        const MAX_BATCH = 500;               // Firestore hard limit
        let batch = writeBatch(db);
        let opCount = 0;

        let success = 0;
        let skipped = 0;

        const commitAndResetBatch = async () => {
            await batch.commit();
            batch = writeBatch(db);
            opCount = 0;
        };

        try {
            for (const raw of importData) {
                // --- 1. Skip completely empty CSV rows ------------------------------
                if (!raw || Object.values(raw).every(v => v === '' || v === null)) {
                    skipped++;
                    continue;
                }

                // --- 2. Normalise / coerce -----------------------------------------
                const item = { ...raw };

                // price
                if (item.price !== undefined) item.price = parseFloat(item.price) || 0;

                // image URLs -> array
                if (item.imageUrl && typeof item.imageUrl === 'string') {
                    item.imageUrls = item.imageUrl.split(';').map(s => s.trim()).filter(Boolean);
                    delete item.imageUrl;
                }

                // status
                item.status = item.status || 'pending';

                // -------------------------------------------------------------------
                let docRef;

                if (item.id) {
                    // UPDATE existing --------------------------------------------------
                    docRef = doc(db, 'products', item.id);
                    const snap = await getDoc(docRef);

                    if (!snap.exists()) {
                        skipped++;
                        continue;
                    }

                    const { id, ...updateFields } = item;
                    batch.update(docRef, { ...updateFields, updatedAt: serverTimestamp() });
                } else {
                    // CREATE new -------------------------------------------------------
                    docRef = doc(PRODUCTS_COLLECTION);      // auto-id
                    batch.set(docRef, {
                        ...item,
                        createdAt: serverTimestamp(),
                        updatedAt: serverTimestamp(),
                    });
                }

                success++;
                opCount++;

                // --- 3. Commit every 500 ops ---------------------------------------
                if (opCount === MAX_BATCH) await commitAndResetBatch();
            }

            // commit leftovers
            if (opCount > 0) await commitAndResetBatch();

            alert(`Import complete:\n✅ ${success} processed\n⏭️ ${skipped} skipped`);
            loadProducts();
        } catch (err) {
            console.error('Error importing products:', err);
            setError('Import failed – check the console for details.');
        } finally {
            setLoading(false);
            setImportModalOpen(false);
            setImportData(null);
            setImportPreview([]);
        }
    };


    // Selection functions
    const toggleSelectProduct = (productId) => {
        setSelectedProducts(prevSelected => {
            if (prevSelected.includes(productId)) {
                return prevSelected.filter(id => id !== productId);
            } else {
                return [...prevSelected, productId];
            }
        });
    };

    const handleSelectAll = () => {
        if (selectAll) {
            setSelectedProducts([]);
        } else {
            setSelectedProducts(products.map(product => product.id));
        }
        setSelectAll(!selectAll);
    };

    // Bulk action functions
    const openBulkActionModal = (action) => {
        setBulkAction(action);
        setBulkActionModalOpen(true);
    };

    const executeBulkAction = async () => {
        if (!bulkAction || selectedProducts.length === 0) return;

        setLoading(true);

        try {
            const batch = writeBatch(db);

            if (bulkAction === 'delete') {
                selectedProducts.forEach(productId => {
                    batch.update(doc(db, 'products', productId), {
                        status: 'deleted',
                        updatedAt: serverTimestamp()
                    });
                });
            } else if (bulkAction === 'activate') {
                selectedProducts.forEach(productId => {
                    batch.update(doc(db, 'products', productId), {
                        status: 'active',
                        updatedAt: serverTimestamp()
                    });
                });
            } else if (bulkAction === 'archive') {
                selectedProducts.forEach(productId => {
                    batch.update(doc(db, 'products', productId), {
                        status: 'archived',
                        updatedAt: serverTimestamp()
                    });
                });
            }

            await batch.commit();

            // Update products in state
            setProducts(prevProducts =>
                prevProducts.map(product => {
                    if (selectedProducts.includes(product.id)) {
                        if (bulkAction === 'delete') {
                            return { ...product, status: 'deleted' };
                        } else if (bulkAction === 'activate') {
                            return { ...product, status: 'active' };
                        } else if (bulkAction === 'archive') {
                            return { ...product, status: 'archived' };
                        }
                    }
                    return product;
                })
            );

            // Clean up
            setBulkActionModalOpen(false);
            setSelectedProducts([]);
            setSelectAll(false);
        } catch (err) {
            console.error('Error executing bulk action:', err);
            setError(`Failed to ${bulkAction} products. Please try again.`);
        } finally {
            setLoading(false);
        }
    };

    // Preview function
    const openPreview = (product) => {
        setPreviewProduct(product);
        setShowPreview(true);
    };

    const closePreview = () => {
        setPreviewProduct(null);
        setShowPreview(false);
    };

    // In-line editing functions
    const startEditing = (product, field) => {
        setEditingProduct(product.id);
        setEditField(field);
        setEditValue(product[field] !== undefined ? product[field].toString() : '');
    };

    const saveEdit = async () => {
        if (!editingProduct || !editField) return;

        const productId = editingProduct;
        const field = editField;
        let value = editValue;

        // Convert value to appropriate type
        if (field === 'price') {
            value = parseFloat(value) || 0;
        }

        try {
            await updateDoc(doc(db, 'products', productId), {
                [field]: value,
                updatedAt: serverTimestamp()
            });

            // Update product in state
            setProducts(prevProducts =>
                prevProducts.map(p =>
                    p.id === productId ? { ...p, [field]: value } : p
                )
            );

            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 2000);
        } catch (err) {
            console.error('Error updating product field:', err);
            setError(`Failed to update ${field}. Please try again.`);
        } finally {
            cancelEdit();
        }
    };

    const cancelEdit = () => {
        setEditingProduct(null);
        setEditField(null);
        setEditValue('');
    };

    // Pagination functions
    const getTotalPages = async () => {
        try {
            const productsRef = collection(db, 'products');
            let countQuery;

            if (selectedStatus !== 'all') {
                countQuery = query(productsRef, where('status', '==', selectedStatus));
            } else {
                countQuery = query(productsRef);
            }

            const snapshot = await getDocs(countQuery);
            const total = snapshot.size;
            const pages = Math.ceil(total / PRODUCTS_PER_PAGE);
            setTotalPages(pages);
        } catch (err) {
            console.error('Error getting total pages:', err);
        }
    };

    const goToPage = async (page) => {
        if (page < 1 || page > totalPages) return;

        setLoading(true);
        setCurrentPage(page);

        try {
            const productsRef = collection(db, 'products');
            let pageQuery;

            if (selectedStatus !== 'all') {
                pageQuery = query(
                    productsRef,
                    where('status', '==', selectedStatus),
                    orderBy(sortField, sortDirection),
                    limit(PRODUCTS_PER_PAGE * page)
                );
            } else {
                pageQuery = query(
                    productsRef,
                    orderBy(sortField, sortDirection),
                    limit(PRODUCTS_PER_PAGE * page)
                );
            }

            const snapshot = await getDocs(pageQuery);
            const allDocs = snapshot.docs;

            // Get just the docs for this page
            const startIdx = (page - 1) * PRODUCTS_PER_PAGE;
            const pageDocuments = allDocs.slice(startIdx);

            const productList = pageDocuments.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            setProducts(productList);

            // Set last visible for pagination
            const lastDoc = pageDocuments[pageDocuments.length - 1];
            setLastVisible(lastDoc);

            // Check if there are more products
            const hasMoreItems = allDocs.length === PRODUCTS_PER_PAGE * page;
            setHasMore(hasMoreItems);
        } catch (err) {
            console.error('Error loading page:', err);
            setError('Failed to load products page. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    // Get total product count for pagination
    useEffect(() => {
        getTotalPages();
    }, [selectedStatus, pageSize]);

    return (
        <div className="admin-panel all-products-panel">
            <div className="panel-header">
                <h3>All Products</h3>

                <div className="action-buttons-row">
                    <button
                        className="export-button"
                        onClick={exportToCSV}
                        title="Export to CSV"
                    >
                        Export CSV
                    </button>
                    <button
                        className="export-button"
                        onClick={exportToJSON}
                        title="Export to JSON"
                    >
                        Export JSON
                    </button>
                    <button
                        className="import-button"
                        onClick={handleImportClick}
                        title="Import Products"
                    >
                        Import Products
                    </button>

                    {selectedProducts.length > 0 && (
                        <div className="bulk-actions">
                            <span>{selectedProducts.length} product(s) selected</span>
                            <button
                                onClick={() => openBulkActionModal('activate')}
                                className="bulk-action-button activate"
                            >
                                Activate
                            </button>
                            <button
                                onClick={() => openBulkActionModal('archive')}
                                className="bulk-action-button archive"
                            >
                                Archive
                            </button>
                            <button
                                onClick={() => openBulkActionModal('delete')}
                                className="bulk-action-button delete"
                            >
                                Delete
                            </button>
                        </div>
                    )}
                </div>

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

                    <div className="page-size-filter">
                        <label htmlFor="page-size">Show:</label>
                        <select
                            id="page-size"
                            value={pageSize}
                            onChange={(e) => setPageSize(Number(e.target.value))}
                        >
                            <option value="10">10</option>
                            <option value="20">20</option>
                            <option value="50">50</option>
                            <option value="100">100</option>
                        </select>
                    </div>
                </div>

                {error && <div className="error-message">{error}</div>}
                {saveSuccess && <div className="success-message">Changes saved successfully!</div>}
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
                    <div className="csv-editor-container">
                        <div className="csv-editor-table-container">
                            <table className="csv-editor-table">
                                <thead>
                                    <tr>
                                        <th className="checkbox-column">
                                            <input
                                                type="checkbox"
                                                checked={selectAll}
                                                onChange={handleSelectAll}
                                            />
                                        </th>
                                        <th className="health-column">Health</th>
                                        <th className="id-column">ID</th>
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
                                            className={`sortable ${sortField === 'category' ? 'active-sort' : ''}`}
                                            onClick={() => handleSortChange('category')}
                                        >
                                            Category
                                            {sortField === 'category' && (
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
                                        <th className="actions-column">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {products.map(product => (
                                        <tr key={product.id} className={showPreview && previewProduct?.id === product.id ? 'selected-row' : ''}>
                                            <td className="checkbox-column">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedProducts.includes(product.id)}
                                                    onChange={() => toggleSelectProduct(product.id)}
                                                />
                                            </td>
                                            <td className="health-column">
                                                <div
                                                    className={`health-indicator ${dataHealth[product.id]?.overall || 'unknown'}`}
                                                    title={`Data health: ${dataHealth[product.id]?.overall || 'unknown'}`}
                                                    onClick={() => openPreview(product)}
                                                ></div>
                                            </td>
                                            <td className="id-column">
                                                <span className="id-text">{product.id.substring(0, 8)}...</span>
                                            </td>
                                            <td>
                                                {editingProduct === product.id && editField === 'name' ? (
                                                    <div className="inline-edit">
                                                        <input
                                                            type="text"
                                                            value={editValue}
                                                            onChange={(e) => setEditValue(e.target.value)}
                                                            autoFocus
                                                        />
                                                        <div className="edit-actions">
                                                            <button onClick={saveEdit} className="save-button">✓</button>
                                                            <button onClick={cancelEdit} className="cancel-button">✕</button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div
                                                        className="editable-cell"
                                                        onClick={() => startEditing(product, 'name')}
                                                    >
                                                        {product.name || 'N/A'}
                                                    </div>
                                                )}
                                            </td>
                                            <td>
                                                {editingProduct === product.id && editField === 'category' ? (
                                                    <div className="inline-edit">
                                                        <input
                                                            type="text"
                                                            value={editValue}
                                                            onChange={(e) => setEditValue(e.target.value)}
                                                            autoFocus
                                                        />
                                                        <div className="edit-actions">
                                                            <button onClick={saveEdit} className="save-button">✓</button>
                                                            <button onClick={cancelEdit} className="cancel-button">✕</button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div
                                                        className="editable-cell"
                                                        onClick={() => startEditing(product, 'category')}
                                                    >
                                                        {product.category || 'N/A'}
                                                    </div>
                                                )}
                                            </td>
                                            <td>
                                                {editingProduct === product.id && editField === 'price' ? (
                                                    <div className="inline-edit">
                                                        <input
                                                            type="number"
                                                            value={editValue}
                                                            onChange={(e) => setEditValue(e.target.value)}
                                                            step="0.01"
                                                            min="0"
                                                            autoFocus
                                                        />
                                                        <div className="edit-actions">
                                                            <button onClick={saveEdit} className="save-button">✓</button>
                                                            <button onClick={cancelEdit} className="cancel-button">✕</button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div
                                                        className="editable-cell"
                                                        onClick={() => startEditing(product, 'price')}
                                                    >
                                                        {formatPrice(product.price)}
                                                    </div>
                                                )}
                                            </td>
                                            <td>
                                                {editingProduct === product.id && editField === 'status' ? (
                                                    <div className="inline-edit">
                                                        <select
                                                            value={editValue}
                                                            onChange={(e) => setEditValue(e.target.value)}
                                                            autoFocus
                                                        >
                                                            <option value="active">Active</option>
                                                            <option value="pending">Pending</option>
                                                            <option value="archived">Archived</option>
                                                            <option value="rejected">Rejected</option>
                                                            <option value="deleted">Deleted</option>
                                                        </select>
                                                        <div className="edit-actions">
                                                            <button onClick={saveEdit} className="save-button">✓</button>
                                                            <button onClick={cancelEdit} className="cancel-button">✕</button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div
                                                        className="editable-cell"
                                                        onClick={() => startEditing(product, 'status')}
                                                    >
                                                        <span className={`status-badge ${product.status}`}>
                                                            {product.status || 'N/A'}
                                                        </span>
                                                    </div>
                                                )}
                                            </td>
                                            <td>
                                                {editingProduct === product.id && editField === 'designerName' ? (
                                                    <div className="inline-edit">
                                                        <input
                                                            type="text"
                                                            value={editValue}
                                                            onChange={(e) => setEditValue(e.target.value)}
                                                            autoFocus
                                                        />
                                                        <div className="edit-actions">
                                                            <button onClick={saveEdit} className="save-button">✓</button>
                                                            <button onClick={cancelEdit} className="cancel-button">✕</button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div
                                                        className="editable-cell"
                                                        onClick={() => startEditing(product, 'designerName')}
                                                    >
                                                        {product.designerName || 'Unknown'}
                                                    </div>
                                                )}
                                            </td>
                                            <td>{formatDate(product.createdAt)}</td>
                                            <td className="actions-column">
                                                <div className="action-buttons">
                                                    <button
                                                        className="preview-button"
                                                        onClick={() => openPreview(product)}
                                                        title="Preview"
                                                    >
                                                        👁️
                                                    </button>
                                                    <button
                                                        className="edit-button"
                                                        onClick={() => handleEditProduct(product.id)}
                                                        title="Full Edit"
                                                    >
                                                        ✏️
                                                    </button>
                                                    {product.status === 'deleted' ? (
                                                        <button
                                                            className="restore-button"
                                                            onClick={() => handleRestoreProduct(product)}
                                                            title="Restore"
                                                        >
                                                            ↩️
                                                        </button>
                                                    ) : (
                                                        <button
                                                            className="delete-button"
                                                            onClick={() => openDeleteModal(product)}
                                                            title="Delete"
                                                        >
                                                            🗑️
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {showPreview && previewProduct && (
                            <div className="product-preview-panel">
                                <div className="preview-header">
                                    <h3>Product Preview</h3>
                                    <button className="close-preview" onClick={closePreview}>×</button>
                                </div>
                                <div className="preview-content">
                                    <div className="preview-image">
                                        <img
                                            src={getProductImage(previewProduct)}
                                            alt={previewProduct.name}
                                        />
                                    </div>
                                    <div className="preview-details">
                                        <h4>{previewProduct.name}</h4>
                                        <p><strong>ID:</strong> {previewProduct.id}</p>
                                        <p><strong>Price:</strong> {formatPrice(previewProduct.price)}</p>
                                        <p><strong>Category:</strong> {previewProduct.category || 'N/A'}</p>
                                        <p><strong>Status:</strong> <span className={`status-badge ${previewProduct.status}`}>{previewProduct.status}</span></p>
                                        <p><strong>Designer:</strong> {previewProduct.designerName || 'Unknown'}</p>
                                        <p><strong>Created:</strong> {formatDate(previewProduct.createdAt)}</p>
                                    </div>

                                    <div className="preview-health">
                                        <h4>Data Health</h4>
                                        <div className="health-details">
                                            {dataHealth[previewProduct.id] && Object.entries(dataHealth[previewProduct.id].fields).map(([field, status]) => (
                                                <div key={field} className="health-item">
                                                    <span className="health-field">{field}:</span>
                                                    <span className={`health-status ${status}`}>
                                                        {status === 'good' ? '✓' : status === 'warning' ? '⚠️' : '✗'}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="preview-description">
                                        <h4>Description</h4>
                                        <p>{previewProduct.description || 'No description available.'}</p>
                                    </div>

                                    <div className="preview-buttons">
                                        <button
                                            className="view-button"
                                            onClick={() => navigate(`/product/${previewProduct.id}`)}
                                        >
                                            View Full Page
                                        </button>
                                        <button
                                            className="edit-button"
                                            onClick={() => handleEditProduct(previewProduct.id)}
                                        >
                                            Edit Product
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="pagination-container">
                            <div className="pagination-controls">
                                <button
                                    onClick={() => goToPage(1)}
                                    disabled={currentPage === 1}
                                    className="pagination-button"
                                >
                                    &laquo; First
                                </button>
                                <button
                                    onClick={() => goToPage(currentPage - 1)}
                                    disabled={currentPage === 1}
                                    className="pagination-button"
                                >
                                    &lt; Prev
                                </button>
                                <span className="page-indicator">
                                    Page {currentPage} of {totalPages}
                                </span>
                                <button
                                    onClick={() => goToPage(currentPage + 1)}
                                    disabled={currentPage === totalPages || totalPages === 0}
                                    className="pagination-button"
                                >
                                    Next &gt;
                                </button>
                                <button
                                    onClick={() => goToPage(totalPages)}
                                    disabled={currentPage === totalPages || totalPages === 0}
                                    className="pagination-button"
                                >
                                    Last &raquo;
                                </button>
                            </div>

                            <div className="items-count">
                                Showing {products.length} of {PRODUCTS_PER_PAGE * totalPages} items
                            </div>
                        </div>
                    </div>
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

            {/* Bulk Action Confirmation Modal */}
            {bulkActionModalOpen && (
                <div className="modal-overlay">
                    <div className="bulk-action-modal">
                        <h3>
                            {bulkAction === 'delete' ? 'Delete Products' :
                                bulkAction === 'activate' ? 'Activate Products' :
                                    bulkAction === 'archive' ? 'Archive Products' : 'Bulk Action'}
                        </h3>
                        <p>Are you sure you want to {bulkAction} {selectedProducts.length} selected products?</p>

                        {bulkAction === 'delete' && (
                            <p className="warning-text">This will mark all selected products as deleted (can be restored later).</p>
                        )}

                        <div className="modal-actions">
                            <button
                                className="confirm-button"
                                onClick={executeBulkAction}
                            >
                                Confirm
                            </button>
                            <button
                                className="cancel-button"
                                onClick={() => {
                                    setBulkActionModalOpen(false);
                                }}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Import Modal */}
            {importModalOpen && (
                <div className="modal-overlay">
                    <div className="import-modal">
                        <h3>Import Products</h3>

                        <div className="import-options">
                            <label>
                                <input
                                    type="radio"
                                    name="importFormat"
                                    value="csv"
                                    checked={importFormat === 'csv'}
                                    onChange={() => setImportFormat('csv')}
                                />
                                CSV Format
                            </label>
                            <label>
                                <input
                                    type="radio"
                                    name="importFormat"
                                    value="json"
                                    checked={importFormat === 'json'}
                                    onChange={() => setImportFormat('json')}
                                />
                                JSON Format
                            </label>
                        </div>

                        <div className="file-upload-container">
                            <input
                                type="file"
                                ref={fileInputRef}
                                accept={importFormat === 'csv' ? '.csv' : '.json'}
                                onChange={handleFileUpload}
                            />
                        </div>

                        {importPreview.length > 0 && (
                            <div className="import-preview">
                                <h4>Preview ({importPreview.length} of {importData?.length || 0} items)</h4>
                                <div className="import-preview-table-container">
                                    <table className="import-preview-table">
                                        <thead>
                                            <tr>
                                                {Object.keys(importPreview[0]).slice(0, 5).map(key => (
                                                    <th key={key}>{key}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {importPreview.map((item, index) => (
                                                <tr key={index}>
                                                    {Object.entries(item).slice(0, 5).map(([key, value]) => (
                                                        <td key={key}>{String(value).substring(0, 30)}</td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <p className="import-count">
                                    {importData?.length || 0} products ready to import
                                </p>
                            </div>
                        )}

                        <div className="modal-actions">
                            <button
                                className="import-button"
                                onClick={importProducts}
                                disabled={!importData || importData.length === 0}
                            >
                                Import Products
                            </button>
                            <button
                                className="cancel-button"
                                onClick={() => {
                                    setImportModalOpen(false);
                                    setImportData(null);
                                    setImportPreview([]);
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