import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, getDocs, query, where, orderBy, limit, startAfter } from 'firebase/firestore';
import { db } from '../config/firebase';
import ProductCard from '../components/ProductCard';
import LoadingSpinner from '../components/LoadingSpinner';
import EnhancedSearchInput from '../components/EnhancedSearchInput';
import { useNavigate } from 'react-router-dom';
import '../styles/ShopPage.css';

const ShopPage = () => {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [lastVisible, setLastVisible] = useState(null);
    const [hasMore, setHasMore] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const navigate = useNavigate();

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const [pageSnapshots, setPageSnapshots] = useState({});
    const [isChangingPage, setIsChangingPage] = useState(false);
    const productsPerPage = 12;
    const maxDisplayedPages = 5; // Number of page buttons to display

    // Filter and sort states
    const [category, setCategory] = useState('all');
    const [sortBy, setSortBy] = useState('newest');
    const [categories, setCategories] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [subCategory, setSubCategory] = useState('all');

    // Predefined subcategories for main categories
    const subCategories = {
        all: [
            { id: 'all', name: 'All Subcategories' }
        ],
        electronics: [
            { id: 'all', name: 'All Electronics' },
            { id: 'smartphones', name: 'Smartphones' },
            { id: 'laptops', name: 'Laptops' },
            { id: 'audio', name: 'Audio Devices' },
            { id: 'wearables', name: 'Wearable Tech' },
            { id: 'accessories', name: 'Accessories' }
        ],
        home: [
            { id: 'all', name: 'All Home' },
            { id: 'furniture', name: 'Furniture' },
            { id: 'decor', name: 'Home Decor' },
            { id: 'kitchen', name: 'Kitchen Appliances' },
            { id: 'bedding', name: 'Bedding & Linens' },
            { id: 'storage', name: 'Storage & Organization' }
        ],
        fashion: [
            { id: 'all', name: 'All Fashion' },
            { id: 'clothing', name: 'Clothing' },
            { id: 'footwear', name: 'Footwear' },
            { id: 'accessories', name: 'Accessories' },
            { id: 'jewelry', name: 'Jewelry' }
        ],
        outdoors: [
            { id: 'all', name: 'All Outdoors' },
            { id: 'camping', name: 'Camping Gear' },
            { id: 'sports', name: 'Sports Equipment' },
            { id: 'garden', name: 'Garden & Patio' },
            { id: 'travel', name: 'Travel Accessories' }
        ],
        health: [
            { id: 'all', name: 'All Health & Beauty' },
            { id: 'personal', name: 'Personal Care' },
            { id: 'fitness', name: 'Fitness Equipment' },
            { id: 'wellness', name: 'Wellness Products' }
        ]
    };

    // Default categories if database fetch fails
    const defaultCategories = [
        { id: 'all', name: 'All Categories' },
        { id: 'electronics', name: 'Electronics' },
        { id: 'home', name: 'Home & Living' },
        { id: 'fashion', name: 'Fashion' },
        { id: 'outdoors', name: 'Outdoors & Recreation' },
        { id: 'health', name: 'Health & Beauty' },
        { id: 'kids', name: 'Kids & Toys' },
        { id: 'books', name: 'Books & Entertainment' },
        { id: 'art', name: 'Art & Collectibles' }
    ];

    // Fetch products for a specific page
    const fetchProductsForPage = async (pageNumber) => {
        if (pageNumber < 1) return;

        setIsChangingPage(true);
        setError(null);

        try {
            // Check if we already have this page stored
            if (pageSnapshots[pageNumber]) {
                setProducts(pageSnapshots[pageNumber].products);
                setLastVisible(pageSnapshots[pageNumber].lastDoc);
                setHasMore(pageSnapshots[pageNumber].hasMore);
                setCurrentPage(pageNumber);
                setIsChangingPage(false);
                return;
            }

            let productsRef = collection(db, 'products');
            let productsQuery;

            // Apply category filter and status filter
            if (category !== 'all') {
                productsQuery = query(
                    productsRef,
                    where('categories', 'array-contains', category),
                    where('status', '==', 'active')
                );
            } else {
                productsQuery = query(
                    productsRef,
                    where('status', '==', 'active')
                );
            }

            // Apply sorting
            switch (sortBy) {
                case 'priceAsc':
                    productsQuery = query(productsQuery, orderBy('price', 'asc'));
                    break;
                case 'priceDesc':
                    productsQuery = query(productsQuery, orderBy('price', 'desc'));
                    break;
                case 'popular':
                    productsQuery = query(productsQuery, orderBy('reviewCount', 'desc'));
                    break;
                case 'rating':
                    productsQuery = query(productsQuery, orderBy('averageRating', 'desc'));
                    break;
                case 'newest':
                default:
                    productsQuery = query(productsQuery, orderBy('createdAt', 'desc'));
                    break;
            }

            // For pages beyond the first, we need the last document from the previous page
            if (pageNumber > 1) {
                // If we have the previous page, use its last document
                if (pageSnapshots[pageNumber - 1]) {
                    productsQuery = query(
                        productsQuery,
                        startAfter(pageSnapshots[pageNumber - 1].lastDoc),
                        limit(productsPerPage)
                    );
                } else {
                    // Otherwise, we need to fetch all previous pages in sequence
                    // This is not ideal for performance but ensures correctness
                    let lastDoc = null;
                    for (let i = 1; i < pageNumber; i++) {
                        const tempQuery = pageSnapshots[i]?.lastDoc
                            ? query(productsQuery, startAfter(pageSnapshots[i].lastDoc), limit(productsPerPage))
                            : query(productsQuery, limit(productsPerPage));

                        const tempSnapshot = await getDocs(tempQuery);
                        if (tempSnapshot.docs.length === 0) {
                            // No more products available
                            setProducts([]);
                            setHasMore(false);
                            setCurrentPage(i);
                            setIsChangingPage(false);
                            return;
                        }

                        lastDoc = tempSnapshot.docs[tempSnapshot.docs.length - 1];

                        // Store this page if we don't have it
                        if (!pageSnapshots[i]) {
                            const pageProducts = tempSnapshot.docs.map(doc => ({
                                id: doc.id,
                                ...doc.data()
                            }));

                            setPageSnapshots(prev => ({
                                ...prev,
                                [i]: {
                                    products: pageProducts,
                                    lastDoc: lastDoc,
                                    hasMore: tempSnapshot.docs.length === productsPerPage
                                }
                            }));
                        }
                    }

                    // Now fetch the requested page
                    productsQuery = query(productsQuery, startAfter(lastDoc), limit(productsPerPage));
                }
            } else {
                // First page, just apply limit
                productsQuery = query(productsQuery, limit(productsPerPage));
            }

            const snapshot = await getDocs(productsQuery);

            // Get products
            let productList = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Filter by subcategory if needed
            if (category !== 'all' && subCategory !== 'all') {
                productList = productList.filter(product =>
                    product.subCategory === subCategory ||
                    (product.tags && product.tags.includes(subCategory))
                );
            }

            // Store last visible document
            const lastDoc = snapshot.docs[snapshot.docs.length - 1];
            setLastVisible(lastDoc);

            // Check if there are more products
            const hasMore = snapshot.docs.length === productsPerPage;
            setHasMore(hasMore);

            // Store this page's data
            setPageSnapshots(prev => ({
                ...prev,
                [pageNumber]: {
                    products: productList,
                    lastDoc: lastDoc,
                    hasMore: hasMore
                }
            }));

            setProducts(productList);
            setCurrentPage(pageNumber);

        } catch (err) {
            console.error(`Error fetching products for page ${pageNumber}:`, err);
            setError(`Failed to load page ${pageNumber}. Please try again.`);
        } finally {
            setIsChangingPage(false);
        }
    };

    // Estimate total number of pages - useful for pagination controls
    const estimateTotalPages = async () => {
        try {
            // Get count query based on current filters
            let productsRef = collection(db, 'products');
            let countQuery;

            if (category !== 'all') {
                countQuery = query(
                    productsRef,
                    where('categories', 'array-contains', category),
                    where('status', '==', 'active')
                );
            } else {
                countQuery = query(
                    productsRef,
                    where('status', '==', 'active')
                );
            }

            // Execute query and count documents
            const snapshot = await getDocs(countQuery);
            const totalCount = snapshot.size;
            setTotalItems(totalCount);

            return totalCount;
        } catch (err) {
            console.error('Error estimating total pages:', err);
            return 0;
        }
    };

    // Fetch categories
    useEffect(() => {
        const fetchCategories = async () => {
            try {
                const categoriesRef = collection(db, 'categories');
                const snapshot = await getDocs(categoriesRef);
                const categoryList = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));

                // Use fetched categories if available, otherwise use defaults
                if (categoryList.length > 0) {
                    setCategories(categoryList);
                } else {
                    console.log('No categories found in database, using defaults');
                    setCategories(defaultCategories.filter(cat => cat.id !== 'all'));
                }
            } catch (err) {
                console.error('Error fetching categories:', err);
                // Use default categories as fallback
                setCategories(defaultCategories.filter(cat => cat.id !== 'all'));
            }
        };

        fetchCategories();
    }, []);

    // Fetch products based on filters and sorting
    useEffect(() => {
        // Reset pagination state when filters change
        setCurrentPage(1);
        setPageSnapshots({});

        // Fetch first page of products and estimate total items
        const initializeProducts = async () => {
            setLoading(true);
            setError(null);

            try {
                // Fetch the first page
                await fetchProductsForPage(1);

                // Estimate total items for pagination
                await estimateTotalPages();
            } catch (err) {
                console.error('Error initializing products:', err);
                setError('Failed to load products. Please try again.');
            } finally {
                setLoading(false);
            }
        };

        initializeProducts();
    }, [category, sortBy, subCategory]);

    // Load more products
    const loadMoreProducts = async () => {
        if (!lastVisible || loadingMore) return;

        setLoadingMore(true);

        try {
            let productsRef = collection(db, 'products');
            let moreProductsQuery;

            // Apply category filter and status filter (only active products)
            if (category !== 'all') {
                moreProductsQuery = query(
                    productsRef,
                    where('categories', 'array-contains', category),  // Changed from category field to categories array
                    where('status', '==', 'active') // Only fetch active products
                );
            } else {
                moreProductsQuery = query(
                    productsRef,
                    where('status', '==', 'active') // Only fetch active products
                );
            }

            // Apply sorting
            switch (sortBy) {
                case 'priceAsc':
                    moreProductsQuery = query(moreProductsQuery, orderBy('price', 'asc'));
                    break;
                case 'priceDesc':
                    moreProductsQuery = query(moreProductsQuery, orderBy('price', 'desc'));
                    break;
                case 'popular':
                    moreProductsQuery = query(moreProductsQuery, orderBy('reviewCount', 'desc'));
                    break;
                case 'rating':
                    moreProductsQuery = query(moreProductsQuery, orderBy('averageRating', 'desc'));
                    break;
                case 'newest':
                default:
                    moreProductsQuery = query(moreProductsQuery, orderBy('createdAt', 'desc'));
                    break;
            }

            // Start after last visible document
            moreProductsQuery = query(
                moreProductsQuery,
                startAfter(lastVisible),
                limit(productsPerPage)
            );

            const snapshot = await getDocs(moreProductsQuery);

            // Get products
            let moreProducts = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Filter by subcategory if selected (client-side filtering)
            if (category !== 'all' && subCategory !== 'all') {
                moreProducts = moreProducts.filter(product =>
                    product.subCategory === subCategory ||
                    (product.tags && product.tags.includes(subCategory))
                );
            }

            // Update last visible
            const lastDoc = snapshot.docs[snapshot.docs.length - 1];
            setLastVisible(lastDoc);

            // Check if there are more products
            setHasMore(moreProducts.length === productsPerPage);

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
    const handleSearch = async (e) => {
        e.preventDefault();

        if (!searchTerm.trim()) return;

        setLoading(true);
        setError(null);

        try {
            // For simple search, we'll fetch all products and filter client-side
            // For production, consider using Firestore extensions like Algolia
            const productsRef = collection(db, 'products');
            const snapshot = await getDocs(productsRef);

            const allProducts = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            const searchTermLower = searchTerm.toLowerCase();

            // Filter products that match the search term
            const filteredProducts = allProducts.filter(product =>
                product.name?.toLowerCase().includes(searchTermLower) ||
                product.description?.toLowerCase().includes(searchTermLower)
            );

            setProducts(filteredProducts);
            setHasMore(false); // Disable pagination for search results
        } catch (err) {
            console.error('Error searching products:', err);
            setError('Failed to search products. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    // Clear search and reset filters
    const handleClearSearch = async () => {
        setSearchTerm('');
        setCategory('all');
        setSortBy('newest');

        // Reload products when search is cleared
        setLoading(true);
        setError(null);

        try {
            const productsRef = collection(db, 'products');
            const productsQuery = query(
                productsRef,
                where('status', '==', 'active'),
                orderBy('createdAt', 'desc'),
                limit(productsPerPage)
            );

            const snapshot = await getDocs(productsQuery);

            const productList = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Set last visible for pagination
            const lastDoc = snapshot.docs[snapshot.docs.length - 1];
            setLastVisible(lastDoc);

            // Check if there are more products
            setHasMore(productList.length === productsPerPage);

            setProducts(productList);
        } catch (err) {
            console.error('Error reloading products:', err);
            setError('Failed to reload products. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    // Clear all filters
    const handleClearAllFilters = async () => {
        setSearchTerm('');
        setCategory('all');
        setSortBy('newest');
        setSubCategory('all');

        // Reload all products when filters are cleared
        setLoading(true);
        setError(null);

        try {
            const productsRef = collection(db, 'products');
            const productsQuery = query(
                productsRef,
                where('status', '==', 'active'),
                orderBy('createdAt', 'desc'),
                limit(productsPerPage)
            );

            const snapshot = await getDocs(productsQuery);

            const productList = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Set last visible for pagination
            const lastDoc = snapshot.docs[snapshot.docs.length - 1];
            setLastVisible(lastDoc);

            // Check if there are more products
            setHasMore(productList.length === productsPerPage);

            setProducts(productList);
        } catch (err) {
            console.error('Error reloading products:', err);
            setError('Failed to reload products. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    // Check if any filter is active
    const isFilterActive = () => {
        return category !== 'all' ||
            sortBy !== 'newest' ||
            (category !== 'all' && subCategory !== 'all') ||
            searchTerm !== '';
    };

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
                            {category !== 'all' && subCategory !== 'all' ? (
                                <> <span className="highlight">{subCategory}</span> products in <span className="highlight">{category}</span></>
                            ) : category !== 'all' ? (
                                <> all <span className="highlight">{category}</span> products</>
                            ) : null}
                            {searchTerm && <> matching "<span className="highlight">{searchTerm}</span>"</>}
                            {sortBy !== 'newest' && <> sorted by <span className="highlight">
                                {sortBy === 'priceAsc' ? 'price (low to high)' :
                                    sortBy === 'priceDesc' ? 'price (high to low)' :
                                        sortBy === 'popular' ? 'popularity' : 'rating'}
                            </span></>}
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
                            >
                                <ProductCard
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
                                    onClick={() => handleProductClick(product.id)}
                                />
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="no-products">
                        <p>No products found. Try adjusting your filters or search terms.</p>
                    </div>
                )}

                {/* Pagination Controls */}
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
                            </div>

                            {/* Next Page Button */}
                            <button
                                className={`pagination-button ${!hasMore ? 'disabled' : ''}`}
                                onClick={() => fetchProductsForPage(currentPage + 1)}
                                disabled={!hasMore || isChangingPage}
                            >
                                Next &raquo;
                            </button>
                        </div>

                        <div className="pagination-info">
                            Showing {(currentPage - 1) * productsPerPage + 1} to {(currentPage - 1) * productsPerPage + products.length} of approximately {totalItems} products
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
