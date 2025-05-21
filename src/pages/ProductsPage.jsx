import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../config/firebase';
import ProductCard from '../components/ProductCard';
import LoadingSpinner from '../components/LoadingSpinner';
import DOMPurify from 'dompurify'; // Import DOMPurify for sanitizing HTML
import { useBlockedContentFilter } from '../components/BlockedContentFilter';
import { useUser } from '../context/UserContext';
import BlockedUsersFilter from '../components/BlockedUsersFilter';
import '../styles/ProductDetailPage.css';

const ProductsPage = () => {
    const navigate = useNavigate();
    const [allProducts, setAllProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [categories, setCategories] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [showAllContent, setShowAllContent] = useState(false);
    const { temporarilyUnblockContent } = useUser();

    // Filter out products from blocked users, unless showAllContent is true
    const products = showAllContent ? allProducts : useBlockedContentFilter(allProducts, 'designerId');

    // Handler for temporarily showing all content
    const handleShowAllContent = () => {
        // Get the IDs of all designers that were filtered out
        if (!showAllContent && allProducts && products) {
            const filteredProducts = allProducts.filter(product =>
                !products.some(p => p.id === product.id)
            );

            // For each filtered product, temporarily unblock the designer
            filteredProducts.forEach(product => {
                if (product.designerId && temporarilyUnblockContent) {
                    temporarilyUnblockContent(product.designerId);
                }
            });
        }

        // Update state to show all content
        setShowAllContent(true);
    };

    useEffect(() => {
        const fetchProducts = async () => {
            setLoading(true);
            try {
                // Fetch categories first
                const categoriesRef = collection(db, 'categories');
                const categoriesSnapshot = await getDocs(categoriesRef);
                const categoriesData = categoriesSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                setCategories(categoriesData);

                // Fetch products
                let productsQuery;
                if (selectedCategory === 'all') {
                    productsQuery = query(
                        collection(db, 'products'),
                        where('status', '==', 'active'),
                        orderBy('createdAt', 'desc'),
                        limit(12)
                    );
                } else {
                    productsQuery = query(
                        collection(db, 'products'),
                        where('categories', 'array-contains', selectedCategory),
                        where('status', '==', 'active'),
                        orderBy('createdAt', 'desc'),
                        limit(12)
                    );
                }

                const productsSnapshot = await getDocs(productsQuery);
                const productsData = productsSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                setAllProducts(productsData);
                setLoading(false);
            } catch (err) {
                console.error("Error fetching products:", err);
                setError("Failed to load products");
                setLoading(false);
            }
        };

        fetchProducts();
    }, [selectedCategory]);

    const handleCategoryChange = (categoryId) => {
        setSelectedCategory(categoryId);
    };

    const handleProductClick = (productId) => {
        navigate(`/product/${productId}`);
    };

    // Format price as currency
    const formatPrice = (price) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(price || 0);
    };

    if (loading) {
        return (
            <div className="products-page">
                <div className="loading-container">
                    <LoadingSpinner />
                    <p>Loading products...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="products-page">
                <div className="error-container">
                    <h2>Error</h2>
                    <p>{error}</p>
                    <button onClick={() => window.location.reload()} className="retry-button">Retry</button>
                </div>
            </div>
        );
    }

    return (
        <div className="products-page">
            <div className="page-header">
                <h1>Products</h1>
            </div>

            <div className="filter-container">
                <div className="category-filter">
                    <button
                        className={`category-btn ${selectedCategory === 'all' ? 'active' : ''}`}
                        onClick={() => setSelectedCategory('all')}
                    >
                        All Products
                    </button>
                    {categories.map(category => (
                        <button
                            key={category.id}
                            className={`category-btn ${selectedCategory === category.id ? 'active' : ''}`}
                            onClick={() => setSelectedCategory(category.id)}
                        >
                            {category.name}
                        </button>
                    ))}
                </div>
            </div>

            {/* Show blocked content filter message if any content was filtered */}
            {allProducts.length > 0 && products.length < allProducts.length && !showAllContent && (
                <BlockedUsersFilter
                    allItems={allProducts}
                    filteredItems={products}
                    contentType="products"
                    onTemporarilyUnblock={handleShowAllContent}
                />
            )}

            {products.length > 0 ? (
                <div className="products-grid">
                    {products.map(product => (
                        <ProductCard
                            key={product.id}
                            id={product.id}
                            image={product.imageUrl || (product.imageUrls && product.imageUrls[0])}
                            images={Array.isArray(product.imageUrls) ? product.imageUrls : product.imageUrl ? [product.imageUrl] : []}
                            title={product.name || 'Unnamed Product'}
                            description={product.description || 'No description available'}
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
                    ))}
                </div>
            ) : (
                <div className="no-products">
                    <h2>No products found</h2>
                    <p>There are no products available in this category yet.</p>
                    {selectedCategory !== 'all' && (
                        <button
                            className="view-all-button"
                            onClick={() => setSelectedCategory('all')}
                        >
                            View All Products
                        </button>
                    )}
                </div>
            )}

            <div className="shop-link-container">
                <Link to="/shop" className="shop-link">
                    Go to Shop
                </Link>
            </div>
        </div>
    );
};

export default ProductsPage;
