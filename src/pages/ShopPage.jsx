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

    const productsPerPage = 12;

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
        const fetchProducts = async () => {
            setLoading(true);
            setError(null);

            try {
                let productsRef = collection(db, 'products');
                let productsQuery;

                // Apply category filter and status filter (only active products)
                if (category !== 'all') {
                    // Use array-contains to match products with multiple categories
                    productsQuery = query(
                        productsRef,
                        where('categories', 'array-contains', category),  // Changed from category field to categories array
                        where('status', '==', 'active') // Only fetch active products
                    );
                } else {
                    productsQuery = query(
                        productsRef,
                        where('status', '==', 'active') // Only fetch active products
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

                // Apply limit
                productsQuery = query(productsQuery, limit(productsPerPage));

                const snapshot = await getDocs(productsQuery);

                // Get products
                let productList = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));

                // Filter by subcategory if selected (client-side filtering as we can't do this in Firestore directly)
                if (category !== 'all' && subCategory !== 'all') {
                    productList = productList.filter(product =>
                        product.subCategory === subCategory ||
                        (product.tags && product.tags.includes(subCategory))
                    );
                }

                // Set last visible for pagination
                const lastDoc = snapshot.docs[snapshot.docs.length - 1];
                setLastVisible(lastDoc);

                // Check if there are more products
                setHasMore(productList.length === productsPerPage);

                setProducts(productList);
            } catch (err) {
                console.error('Error fetching products:', err);
                setError('Failed to load products. Please try again.');
            } finally {
                setLoading(false);
            }
        };

        fetchProducts();
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

                {/* Load More Button */}
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

                {loadingMore && (
                    <div className="loading-more">
                        <LoadingSpinner />
                    </div>
                )}
            </div>
        </div>
    );
};

export default ShopPage;
