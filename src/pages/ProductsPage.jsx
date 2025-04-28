import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../config/firebase';
import ProductCard from '../components/ProductCard';
import LoadingSpinner from '../components/LoadingSpinner';
import DOMPurify from 'dompurify'; // Import DOMPurify for sanitizing HTML
import '../styles/ProductsPage.css';

const ProductsPage = () => {
    const navigate = useNavigate();
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [categories, setCategories] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState('all');

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
                setProducts(productsData);
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
            <div className="products-container">
                <h1>Products Catalog</h1>

                <div className="category-filter">
                    <button
                        className={`category-button ${selectedCategory === 'all' ? 'active' : ''}`}
                        onClick={() => handleCategoryChange('all')}
                    >
                        All Products
                    </button>
                    {categories.map(category => (
                        <button
                            key={category.id}
                            className={`category-button ${selectedCategory === category.id ? 'active' : ''}`}
                            onClick={() => handleCategoryChange(category.id)}
                        >
                            {category.name}
                        </button>
                    ))}
                </div>

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
                        <p>No products found in this category.</p>
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
        </div>
    );
};

export default ProductsPage;
