// filepath: c:\Users\GGPC\Desktop\mnop-app\src\pages\ShopPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { collection, getDocs, query, where, orderBy, limit, startAfter, startAt, getCountFromServer, doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import ProductCard from '../components/ProductCard';
import LoadingSpinner from '../components/LoadingSpinner';
import EnhancedSearchInput from '../components/EnhancedSearchInput';
import { useNavigate } from 'react-router-dom';
import '../styles/ShopPage.css';

const ShopPage = () => {
    const navigate = useNavigate();    // State for products and filtering
    const [products, setProducts] = useState([]);
    const [allProductsData, setAllProductsData] = useState([]); // Cache for all products when searching
    const [categories, setCategories] = useState([]);
    const [subCategories, setSubCategories] = useState({});
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState('');
    const [isChangingPage, setIsChangingPage] = useState(false);

    // Pagination state
    const [lastVisible, setLastVisible] = useState(null);
    const [firstVisible, setFirstVisible] = useState(null);
    const [hasMore, setHasMore] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const productsPerPage = 12;
    const maxDisplayedPages = 5;

    // Filter state
    const [category, setCategory] = useState('all');
    const [subCategory, setSubCategory] = useState('all');
    const [sortBy, setSortBy] = useState('newest');
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
    const [productType, setProductType] = useState('all'); // 'all', 'crowdfunded', or 'direct'
    const [purchaseReady, setPurchaseReady] = useState(false); // Filter for products ready to purchase    // Function to check if any filters are active
    const isFilterActive = () => {
        return category !== 'all' || sortBy !== 'newest' || searchTerm !== '' || productType !== 'all' || purchaseReady;
    };    // Function to clear all filters
    const handleClearAllFilters = () => {
        setCategory('all');
        setSubCategory('all');
        setSortBy('newest');
        setSearchTerm('');
        setDebouncedSearchTerm('');
        setProductType('all');
        setPurchaseReady(false);
        setAllProductsData([]);  // Clear the products cache
        setCurrentPage(1);       // Reset to first page
    };

    // Fetch categories on component mount
    useEffect(() => {
        const fetchCategories = async () => {
            try {
                const categoriesCollection = await getDocs(collection(db, 'categories'));
                const categoriesData = categoriesCollection.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));

                setCategories(categoriesData);

                // Create subcategories mapping
                const subCatsMap = {};

                // Add "All" option for each category
                categoriesData.forEach(cat => {
                    if (cat.subCategories && cat.subCategories.length > 0) {
                        subCatsMap[cat.id] = [
                            { id: 'all', name: 'All' },
                            ...cat.subCategories
                        ];
                    }
                });

                setSubCategories(subCatsMap);
            } catch (err) {
                console.error("Error fetching categories:", err);
                setError("Failed to load categories. Please try again later.");
            }
        };

        fetchCategories();
    }, []);

    // Build query based on filters
    const buildProductQuery = useCallback(() => {
        let productsRef = collection(db, 'products');
        let constraints = [];

        // Filter by status - only show active products
        constraints.push(where('status', '==', 'active'));

        // Filter by approval status (if needed)
        // constraints.push(where('approved', '==', true));        // Filter by category
        if (category !== 'all') {
            constraints.push(where('categories', 'array-contains', category));
        }

        // Filter by product type
        if (productType === 'crowdfunded') {
            constraints.push(where('isCrowdfunded', '==', true));
        } else if (productType === 'direct') {
            constraints.push(where('isCrowdfunded', '==', false));
        }

        // Filter by readyForPurchase status if selected
        if (purchaseReady) {
            constraints.push(where('readyForPurchase', '==', true));
        }

        // Sort by selected option
        let sortConstraint;
        switch (sortBy) {
            case 'priceAsc':
                sortConstraint = orderBy('price', 'asc');
                break;
            case 'priceDesc':
                sortConstraint = orderBy('price', 'desc');
                break;
            case 'popular':
                sortConstraint = orderBy('viewCount', 'desc');
                break;
            case 'rating':
                sortConstraint = orderBy('averageRating', 'desc');
                break;
            case 'newest':
            default:
                sortConstraint = orderBy('createdAt', 'desc');
                break;
        }

        constraints.push(sortConstraint);

        // Limit the number of products per page
        constraints.push(limit(productsPerPage)); return query(productsRef, ...constraints);
    }, [category, sortBy, productType, productsPerPage, purchaseReady]);

    // Function to count total items
    const countTotalItems = useCallback(async () => {
        try {
            let productsRef = collection(db, 'products');
            let constraints = [];

            // Only count active products
            constraints.push(where('status', '==', 'active'));

            // Filter by category if selected
            if (category !== 'all') {
                constraints.push(where('categories', 'array-contains', category));
            }            // Filter by product type
            if (productType === 'crowdfunded') {
                constraints.push(where('isCrowdfunded', '==', true));
            } else if (productType === 'direct') {
                constraints.push(where('isCrowdfunded', '==', false));
            }

            // Filter by readyForPurchase status if selected
            if (purchaseReady) {
                constraints.push(where('readyForPurchase', '==', true));
            }

            const countQuery = query(productsRef, ...constraints);
            const snapshot = await getCountFromServer(countQuery);
            setTotalItems(snapshot.data().count);
        } catch (err) {
            console.error("Error counting products:", err);
        }
    }, [category, productType, purchaseReady]);

    // Function to fetch products based on current filters
    const fetchProducts = useCallback(async (isInitialLoad = false) => {
        if (isInitialLoad) {
            setLoading(true);
        } else {
            setLoadingMore(true);
        }

        setError('');

        try {
            let productsRef = collection(db, 'products');
            let constraints = [];

            // Always filter by status - only show active products
            constraints.push(where('status', '==', 'active'));

            // Filter by category
            if (category !== 'all') {
                constraints.push(where('categories', 'array-contains', category));
            }            // Filter by product type
            if (productType === 'crowdfunded') {
                constraints.push(where('isCrowdfunded', '==', true));
            } else if (productType === 'direct') {
                constraints.push(where('isCrowdfunded', '==', false));
            }

            // Filter by readyForPurchase status if selected
            if (purchaseReady) {
                constraints.push(where('readyForPurchase', '==', true));
            }

            // Sort by selected option
            let sortField = 'createdAt';
            let sortDirection = 'desc';

            switch (sortBy) {
                case 'priceAsc':
                    sortField = 'price';
                    sortDirection = 'asc';
                    break;
                case 'priceDesc':
                    sortField = 'price';
                    sortDirection = 'desc';
                    break;
                case 'popular':
                    sortField = 'viewCount';
                    sortDirection = 'desc';
                    break;
                case 'rating':
                    sortField = 'averageRating';
                    sortDirection = 'desc';
                    break;
            }

            constraints.push(orderBy(sortField, sortDirection));

            // If we're searching, we need to fetch ALL products that match our filters
            // to perform client-side filtering properly
            let productQuery;
            if (debouncedSearchTerm) {
                // Fetch without a limit to get all matching products
                productQuery = query(productsRef, ...constraints);
            } else {
                // Normal pagination with limit
                productQuery = query(productsRef, ...constraints, limit(productsPerPage));
            }

            const querySnapshot = await getDocs(productQuery);

            // Map the product data
            const productsData = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Filter by search term on client side if provided
            const filteredProducts = debouncedSearchTerm ?
                productsData.filter(product =>
                    product.name?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
                    product.description?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
                    (product.tags && product.tags.some(tag => tag.toLowerCase().includes(debouncedSearchTerm.toLowerCase())))
                ) :
                productsData;            // Update pagination for search results vs normal results
            if (debouncedSearchTerm) {
                // Store all fetched products for future pagination
                setAllProductsData(productsData);

                // For search results, we implement client-side pagination
                // Just set the total items to the filtered count
                setTotalItems(filteredProducts.length);

                // Only display the current page worth of products
                const startIndex = (currentPage - 1) * productsPerPage;
                const endIndex = startIndex + productsPerPage;
                const paginatedProducts = filteredProducts.slice(startIndex, endIndex);

                // Set has more based on whether there are more items after this page
                setHasMore(endIndex < filteredProducts.length);
                setProducts(paginatedProducts);
            } else {                // Clear the cache when not searching
                setAllProductsData([]);

                // For normal pagination, update controls as before
                const lastVisible = querySnapshot.docs[querySnapshot.docs.length - 1];
                const firstVisible = querySnapshot.docs[0];

                // Make sure we're actually storing these document references correctly
                if (lastVisible && firstVisible) {
                    setLastVisible(lastVisible);
                    setFirstVisible(firstVisible);
                }

                setHasMore(querySnapshot.docs.length === productsPerPage);
                setProducts(filteredProducts);

                // Count total items for pagination
                countTotalItems();
            }
        } catch (err) {
            console.error("Error fetching products:", err);
            setError("Failed to load products. Please try again later.");
        } finally {
            setLoading(false);
            setLoadingMore(false);
            setIsChangingPage(false);
        }
    }, [buildProductQuery, countTotalItems, debouncedSearchTerm, productsPerPage, category, sortBy, productType, currentPage]);    // Function to fetch products for a specific page
    const fetchProductsForPage = async (pageNumber) => {
        setIsChangingPage(true);
        setCurrentPage(pageNumber);

        // If we are searching, use client-side pagination from our cached results
        if (debouncedSearchTerm) {
            try {
                if (allProductsData.length > 0) {
                    // We already have all products cached, just filter and paginate
                    const filteredProducts = allProductsData.filter(product =>
                        product.name?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
                        product.description?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
                        (product.tags && product.tags.some(tag => tag.toLowerCase().includes(debouncedSearchTerm.toLowerCase())))
                    );

                    // Calculate pagination
                    const startIndex = (pageNumber - 1) * productsPerPage;
                    const endIndex = startIndex + productsPerPage;
                    const paginatedProducts = filteredProducts.slice(startIndex, endIndex);

                    setTotalItems(filteredProducts.length);
                    setHasMore(endIndex < filteredProducts.length);
                    setProducts(paginatedProducts);
                } else {
                    // Fetch all products if we don't have them cached yet
                    await fetchProducts(true);
                }
            } catch (err) {
                console.error("Error fetching search results page:", err);
                setError("Failed to load products. Please try again later.");
            } finally {
                setIsChangingPage(false);
            }
            return;
        }

        // Normal pagination for non-search results
        try {
            // For page 1, just fetch the first page
            if (pageNumber === 1) {
                await fetchProducts(true);
                return;
            }

            let productsRef = collection(db, 'products');
            let constraints = [];

            // Basic filters
            constraints.push(where('status', '==', 'active'));

            // Category filter
            if (category !== 'all') {
                constraints.push(where('categories', 'array-contains', category));
            }

            // Filter by product type
            if (productType === 'crowdfunded') {
                constraints.push(where('isCrowdfunded', '==', true));
            } else if (productType === 'direct') {
                constraints.push(where('isDirectSell', '==', true));
            }

            // Sort constraint
            let sortField = 'createdAt';
            let sortDirection = 'desc';

            switch (sortBy) {
                case 'priceAsc':
                    sortField = 'price';
                    sortDirection = 'asc';
                    break;
                case 'priceDesc':
                    sortField = 'price';
                    sortDirection = 'desc';
                    break;
                case 'popular':
                    sortField = 'viewCount';
                    sortDirection = 'desc';
                    break;
                case 'rating':
                    sortField = 'averageRating';
                    sortDirection = 'desc';
                    break;
            }

            constraints.push(orderBy(sortField, sortDirection));

            // For page 2 and beyond, use different pagination approaches
            if (pageNumber === 2 && lastVisible) {
                // For page 2, we can use the lastVisible document from page 1
                try {
                    // Start after the last document from page 1
                    const nextPageQuery = query(
                        productsRef,
                        ...constraints,
                        startAfter(lastVisible),
                        limit(productsPerPage)
                    );

                    const nextPageSnapshot = await getDocs(nextPageQuery);

                    if (!nextPageSnapshot.empty) {
                        const productsData = nextPageSnapshot.docs.map(doc => ({
                            id: doc.id,
                            ...doc.data()
                        }));

                        setProducts(productsData);
                        setLastVisible(nextPageSnapshot.docs[nextPageSnapshot.docs.length - 1]);
                        setFirstVisible(nextPageSnapshot.docs[0]);
                        setHasMore(nextPageSnapshot.docs.length === productsPerPage);
                    } else {
                        // No results for page 2
                        setProducts([]);
                        setHasMore(false);
                    }
                } catch (err) {
                    console.error("Error fetching page 2:", err);
                    setError("Failed to load page 2");
                }
            } else {
                // For pages > 2 or if we don't have lastVisible cursor, use a different approach
                try {
                    // Get first page results first
                    const firstPageQuery = query(productsRef, ...constraints, limit(productsPerPage));
                    const firstPageSnapshot = await getDocs(firstPageQuery);

                    if (firstPageSnapshot.empty) {
                        // No results at all
                        setProducts([]);
                        setHasMore(false);
                        setIsChangingPage(false);
                        return;
                    }

                    // We'll implement a sequential pagination approach
                    let currentPage = 1;
                    let currentSnapshot = firstPageSnapshot;
                    let lastDocInCurrentPage = currentSnapshot.docs[currentSnapshot.docs.length - 1];

                    // Keep fetching next pages until we reach the desired page
                    while (currentPage < pageNumber) {
                        if (!lastDocInCurrentPage) {
                            // We've run out of documents
                            setProducts([]);
                            setHasMore(false);
                            setIsChangingPage(false);
                            return;
                        }

                        // Fetch the next page
                        const nextPageQuery = query(
                            productsRef,
                            ...constraints,
                            startAfter(lastDocInCurrentPage),
                            limit(productsPerPage)
                        );

                        const nextSnapshot = await getDocs(nextPageQuery);

                        if (nextSnapshot.empty) {
                            // No more results
                            setProducts([]);
                            setHasMore(false);
                            setIsChangingPage(false);
                            return;
                        }

                        // Update tracking variables
                        currentSnapshot = nextSnapshot;
                        lastDocInCurrentPage = currentSnapshot.docs[currentSnapshot.docs.length - 1];
                        currentPage++;
                    }

                    // By now, currentSnapshot contains our target page
                    const productsData = currentSnapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    }));

                    setProducts(productsData);
                    setLastVisible(lastDocInCurrentPage);
                    setFirstVisible(currentSnapshot.docs[0]);
                    setHasMore(currentSnapshot.docs.length === productsPerPage);
                } catch (err) {
                    console.error("Error during pagination:", err);
                    setError("Failed to load page " + pageNumber);
                }
            }
        } catch (err) {
            console.error("Error fetching page:", err);
            setError("Failed to load products. Please try again later.");
        } finally {
            setIsChangingPage(false);
        }
    };    // Load initial products on mount only
    useEffect(() => {
        fetchProducts(true);
    }, []); // Removed dependency on fetchProducts to prevent re-runs    // Reload products when filters change
    useEffect(() => {
        // Reset to page 1 when filters change
        setCurrentPage(1);
        setLastVisible(null);
        setFirstVisible(null);
        fetchProducts(true);
    }, [category, sortBy, productType, purchaseReady]); // Removed fetchProducts dependency

    // Debounce the search term to avoid frequent updates
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchTerm(searchTerm);
        }, 500);

        return () => clearTimeout(timer);
    }, [searchTerm]);    // Fetch products when the debounced search term changes
    useEffect(() => {
        // Reset to page 1 when search term changes
        setCurrentPage(1);
        setLastVisible(null);
        setFirstVisible(null);
        fetchProducts(true);
    }, [debouncedSearchTerm]); // Removed fetchProducts dependency

    // Product navigation handler
    const handleProductClick = (productId) => {
        navigate(`/product/${productId}`);
    };

    // Display loading state
    if (loading && !loadingMore) {
        return (
            <div className="shop-page">
                <div className="shop-container">
                    <h1>Shop Products</h1>
                    <div className="loading-container">
                        <LoadingSpinner />
                    </div>
                </div>
            </div>
        );
    }

    // Display error state
    if (error && !products.length) {
        return (
            <div className="shop-page">
                <div className="shop-container">
                    <h1>Shop Products</h1>
                    <div className="error-container">
                        <p>{error}</p>
                        <button
                            className="btn-primary"
                            onClick={() => {
                                setCategory('all');
                                setSortBy('newest');
                                setSearchTerm('');
                            }}
                        >
                            Try Again
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="shop-page">
            <div className="shop-container">
                <h1>Shop Products</h1>

                {/* Search and Filters */}
                <div className="shop-controls">
                    <div className="shop-search-container">
                        <EnhancedSearchInput
                            placeholder="Search products in shop..."
                            className="shop-enhanced-search"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onClear={() => setSearchTerm('')}
                            onSearch={(term) => {
                                setSearchTerm(term);
                            }}
                        />
                    </div>

                    <div className="filters">
                        <div className="filter-group">
                            <label htmlFor="category">Category:</label>
                            <select
                                id="category"
                                value={category}
                                onChange={(e) => {
                                    setCategory(e.target.value);
                                    setSubCategory('all'); // Reset subcategory when main category changes
                                }}
                                className={`filter-select ${category !== 'all' ? 'active-filter' : ''}`}
                            >
                                <option value="all">All Categories</option>
                                {categories.map(cat => (
                                    <option key={cat.id} value={cat.id}>
                                        {cat.name}
                                    </option>
                                ))}
                            </select>
                            {category !== 'all' && <span className="filter-badge"></span>}
                        </div>

                        {/* Subcategory filter - only show if a main category is selected */}
                        {category !== 'all' && subCategories[category] && (
                            <div className="filter-group subcategory-group">
                                <label htmlFor="subcategory">Subcategory:</label>
                                <select
                                    id="subcategory"
                                    value={subCategory}
                                    onChange={(e) => setSubCategory(e.target.value)}
                                    className={`filter-select ${subCategory !== 'all' ? 'active-filter' : ''}`}
                                >
                                    {(subCategories[category] || subCategories.all).map(subCat => (
                                        <option key={subCat.id} value={subCat.id}>
                                            {subCat.name}
                                        </option>
                                    ))}
                                </select>
                                {subCategory !== 'all' && <span className="filter-badge"></span>}
                            </div>
                        )}

                        <div className="filter-group">
                            <label htmlFor="sortBy">Sort by:</label>
                            <select
                                id="sortBy"
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value)}
                                className={`filter-select ${sortBy !== 'newest' ? 'active-filter' : ''}`}
                            >
                                <option value="newest">Newest</option>
                                <option value="priceAsc">Price: Low to High</option>
                                <option value="priceDesc">Price: High to Low</option>
                                <option value="popular">Most Popular</option>
                                <option value="rating">Highest Rated</option>
                            </select>
                            {sortBy !== 'newest' && <span className="filter-badge"></span>}
                        </div>

                        <div className="filter-group">
                            <label htmlFor="productType">Type:</label>
                            <select
                                id="productType"
                                value={productType}
                                onChange={(e) => setProductType(e.target.value)}
                                className={`filter-select ${productType !== 'all' ? 'active-filter' : ''}`}
                            >
                                <option value="all">All Products</option>
                                <option value="crowdfunded">Crowdfunded</option>
                                <option value="direct">Direct Sell</option>                            </select>
                            {productType !== 'all' && <span className="filter-badge"></span>}
                        </div>

                        <div className="filter-group">
                            <label className="checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={purchaseReady}
                                    onChange={(e) => setPurchaseReady(e.target.checked)}
                                    className="filter-checkbox"
                                />
                                Ready for Purchase
                                {purchaseReady && <span className="filter-badge"></span>}
                            </label>
                        </div>
                    </div>

                    {/* Clear Filters Button */}
                    {isFilterActive() && (
                        <button
                            className="clear-filters-button"
                            onClick={handleClearAllFilters}
                        >
                            Clear Filters
                        </button>
                    )}

                    {/* Filter Summary */}
                    {isFilterActive() && (
                        <div className="filter-summary">
                            Showing
                            {productType !== 'all' && <> <span className="highlight">
                                {productType === 'crowdfunded' ? 'crowdfunded' : 'direct sell'}
                            </span> products</>}
                            {category !== 'all' && subCategory !== 'all' ? (
                                <> in <span className="highlight">{subCategory}</span> category of <span className="highlight">{category}</span></>
                            ) : category !== 'all' ? (
                                <> in <span className="highlight">{category}</span> category</>
                            ) : null}
                            {searchTerm && <> matching "<span className="highlight">{searchTerm}</span>"</>}                            {sortBy !== 'newest' && <> sorted by <span className="highlight">
                                {sortBy === 'priceAsc' ? 'price (low to high)' :
                                    sortBy === 'priceDesc' ? 'price (high to low)' :
                                        sortBy === 'popular' ? 'popularity' : 'rating'}
                            </span></>}
                            {purchaseReady && <> that are <span className="highlight">ready for purchase</span></>}
                        </div>
                    )}
                </div>

                {/* Products Grid */}
                {products.length > 0 ? (
                    <div className="products-grid">
                        {products.map(product => (
                            <div
                                key={product.id}
                                className="product-link"
                            >                                <ProductCard
                                    id={product.id}
                                    image={product.imageUrl || (product.imageUrls && product.imageUrls[0]) || 'https://placehold.co/300x300?text=Product'}
                                    images={Array.isArray(product.imageUrls) ? product.imageUrls : product.imageUrl ? [product.imageUrl] : []}
                                    title={product.name || 'Unnamed Product'}
                                    description={product.description ? product.description.slice(0, 100) + (product.description.length > 100 ? '...' : '') : 'No description available'}
                                    price={typeof product.price === 'number' ? product.price : parseFloat(product.price) || 0}
                                    rating={typeof product.averageRating === 'number' ? product.averageRating : 0}
                                    reviewCount={typeof product.reviewCount === 'number' ? product.reviewCount : 0}
                                    viewers={typeof product.activeViewers === 'number' ? product.activeViewers : 0}
                                    fundingProgress={product.fundingGoal > 0 ? Math.min((product.currentFunding || 0) / product.fundingGoal * 100, 100) : 0}
                                    currentFunding={typeof product.currentFunding === 'number' ? product.currentFunding : 0}
                                    fundingGoal={typeof product.fundingGoal === 'number' ? product.fundingGoal : 0}
                                    status={product.status || 'active'}
                                    designerId={product.designerId || ''}
                                    readyForPurchase={product.readyForPurchase || false} // Pass the readyForPurchase flag
                                    onClick={() => handleProductClick(product.id)}
                                />
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="no-products">

                        <p>No products found. Try adjusting your filters or search terms.</p>
                    </div>
                )}                {/* Pagination Controls */}
                {products.length > 0 && totalItems > productsPerPage && (
                    <div className="pagination-container">
                        <div className="pagination-controls">
                            {/* Previous Page Button */}
                            <button
                                className={`pagination-button ${currentPage === 1 ? 'disabled' : ''}`}
                                onClick={() => fetchProductsForPage(currentPage - 1)}
                                disabled={currentPage === 1 || isChangingPage}
                            >
                                &laquo; Previous
                            </button>

                            {/* Page Number Buttons */}
                            <div className="page-numbers">
                                {(() => {
                                    // Estimated total pages
                                    const totalPages = Math.ceil(totalItems / productsPerPage);
                                    const pageNumbers = [];

                                    // Logic to determine which page buttons to show
                                    let startPage, endPage;

                                    if (totalPages <= maxDisplayedPages) {
                                        // If we have fewer pages than max display, show all
                                        startPage = 1;
                                        endPage = totalPages;
                                    } else {
                                        // Calculate start and end pages based on current page position
                                        const maxPagesBeforeCurrentPage = Math.floor(maxDisplayedPages / 2);
                                        const maxPagesAfterCurrentPage = Math.ceil(maxDisplayedPages / 2) - 1;

                                        if (currentPage <= maxPagesBeforeCurrentPage) {
                                            // Near the start
                                            startPage = 1;
                                            endPage = maxDisplayedPages;
                                        } else if (currentPage + maxPagesAfterCurrentPage >= totalPages) {
                                            // Near the end
                                            startPage = totalPages - maxDisplayedPages + 1;
                                            endPage = totalPages;
                                        } else {
                                            // Middle
                                            startPage = currentPage - maxPagesBeforeCurrentPage;
                                            endPage = currentPage + maxPagesAfterCurrentPage;
                                        }
                                    }

                                    // Add "First" page button if needed
                                    if (startPage > 1) {
                                        pageNumbers.push(
                                            <button
                                                key="first"
                                                className={`pagination-button page-number`}
                                                onClick={() => fetchProductsForPage(1)}
                                                disabled={isChangingPage}
                                            >
                                                1
                                            </button>
                                        );

                                        if (startPage > 2) {
                                            pageNumbers.push(
                                                <span key="ellipsis1" className="pagination-ellipsis">...</span>
                                            );
                                        }
                                    }

                                    // Add page number buttons
                                    for (let i = startPage; i <= endPage; i++) {
                                        pageNumbers.push(
                                            <button
                                                key={i}
                                                className={`pagination-button page-number ${i === currentPage ? 'active' : ''}`}
                                                onClick={() => fetchProductsForPage(i)}
                                                disabled={i === currentPage || isChangingPage}
                                            >
                                                {i}
                                            </button>
                                        );
                                    }

                                    // Add "Last" page button if needed
                                    if (endPage < totalPages) {
                                        if (endPage < totalPages - 1) {
                                            pageNumbers.push(
                                                <span key="ellipsis2" className="pagination-ellipsis">...</span>
                                            );
                                        }

                                        pageNumbers.push(
                                            <button
                                                key="last"
                                                className={`pagination-button page-number`}
                                                onClick={() => fetchProductsForPage(totalPages)}
                                                disabled={isChangingPage}
                                            >
                                                {totalPages}
                                            </button>
                                        );
                                    }

                                    return pageNumbers;
                                })()}
                            </div>                            {/* Next Page Button */}                            <button
                                className={`pagination-button ${(!hasMore || currentPage >= Math.ceil(totalItems / productsPerPage)) ? 'disabled' : ''}`}
                                onClick={() => fetchProductsForPage(currentPage + 1)}
                                disabled={(!hasMore || currentPage >= Math.ceil(totalItems / productsPerPage)) || isChangingPage}
                            >
                                Next &raquo;
                            </button>
                        </div>                        <div className="pagination-info">
                            Showing {(currentPage - 1) * productsPerPage + 1} to {(currentPage - 1) * productsPerPage + products.length} of {totalItems} products
                            {debouncedSearchTerm && <span> matching "{debouncedSearchTerm}"</span>}
                        </div>
                    </div>
                )}

                {isChangingPage && (
                    <div className="loading-more">
                        <LoadingSpinner />
                    </div>
                )}
            </div>
        </div>
    );
};

export default ShopPage;
