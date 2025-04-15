import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, getDocs, query, where, orderBy, limit, startAfter } from 'firebase/firestore';
import { db } from '../config/firebase';
import ProductCard from '../components/ProductCard';
import LoadingSpinner from '../components/LoadingSpinner';
import '../styles/ShopPage.css';

const ShopPage = () => {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [lastVisible, setLastVisible] = useState(null);
    const [hasMore, setHasMore] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);

    // Filter and sort states
    const [category, setCategory] = useState('all');
    const [sortBy, setSortBy] = useState('newest');
    const [categories, setCategories] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');

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
                setCategories(categoryList);
            } catch (err) {
                console.error('Error fetching categories:', err);
                // Don't set error state here to allow product fetching to continue
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

                // Apply category filter if not 'all'
                if (category !== 'all') {
                    productsQuery = query(
                        productsRef,
                        where('category', '==', category)
                    );
                } else {
                    productsQuery = productsRef;
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
                        productsQuery = query(productsQuery, orderBy('viewCount', 'desc'));
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
                console.error('Error fetching products:', err);
                setError('Failed to load products. Please try again.');
            } finally {
                setLoading(false);
            }
        };

        fetchProducts();
    }, [category, sortBy]);

    // Load more products
    const loadMoreProducts = async () => {
        if (!lastVisible || loadingMore) return;

        setLoadingMore(true);

        try {
            let productsRef = collection(db, 'products');
            let moreProductsQuery;

            // Apply category filter if not 'all'
            if (category !== 'all') {
                moreProductsQuery = query(
                    productsRef,
                    where('category', '==', category)
                );
            } else {
                moreProductsQuery = productsRef;
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
                    moreProductsQuery = query(moreProductsQuery, orderBy('viewCount', 'desc'));
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
            const moreProducts = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

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
    const handleClearSearch = () => {
        setSearchTerm('');
        setCategory('all');
        setSortBy('newest');
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
                    <form className="search-form" onSubmit={handleSearch}>
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search products..."
                            className="search-input"
                        />
                        <button type="submit" className="search-button">Search</button>
                        {searchTerm && (
                            <button
                                type="button"
                                className="clear-search"
                                onClick={handleClearSearch}
                            >
                                Clear
                            </button>
                        )}
                    </form>

                    <div className="filters">
                        <div className="filter-group">
                            <label htmlFor="category">Category:</label>
                            <select
                                id="category"
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                                className="filter-select"
                            >
                                <option value="all">All Categories</option>
                                {categories.map(cat => (
                                    <option key={cat.id} value={cat.id}>
                                        {cat.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="filter-group">
                            <label htmlFor="sortBy">Sort by:</label>
                            <select
                                id="sortBy"
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value)}
                                className="filter-select"
                            >
                                <option value="newest">Newest</option>
                                <option value="priceAsc">Price: Low to High</option>
                                <option value="priceDesc">Price: High to Low</option>
                                <option value="popular">Most Popular</option>
                                <option value="rating">Highest Rated</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Products Grid */}
                {products.length > 0 ? (
                    <div className="products-grid">
                        {products.map(product => (
                            <Link
                                to={`/products/${product.id}`}
                                key={product.id}
                                className="product-link"
                            >
                                <ProductCard
                                    image={product.imageUrl || 'https://via.placeholder.com/300'}
                                    title={product.name || 'Unnamed Product'}
                                    description={product.description?.slice(0, 100) || 'No description'}
                                    price={product.price || 0}
                                    rating={product.averageRating || 0}
                                    reviewCount={product.reviewCount || 0}
                                    viewers={product.activeViewers || 0}
                                />
                            </Link>
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
