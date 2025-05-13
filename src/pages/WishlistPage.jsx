import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { useToast } from '../contexts/ToastContext';
import wishlistService from '../services/wishlistService';
import LoadingSpinner from '../components/LoadingSpinner';
import ProductCard from '../components/ProductCard';
import { FaTimes } from 'react-icons/fa';
import '../styles/WishlistPage.css';

const WishlistPage = () => {
    const { user } = useUser();
    const { success: showSuccess, error: showError } = useToast();
    const navigate = useNavigate();

    const [wishlistItems, setWishlistItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);    // Fetch wishlist data
    useEffect(() => {
        const fetchWishlist = async () => {
            if (!user) {
                return;
            }

            setLoading(true);
            setError(null); try {
                const { success, items, error } = await wishlistService.getWishlist(user.uid);

                if (success) {
                    // Sort products by when they were added (newest first)
                    const sortedProducts = items ? [...items].sort((a, b) => {
                        // Handle server timestamps
                        const dateA = a.addedAt?.toDate?.() || new Date(a.addedAt || 0);
                        const dateB = b.addedAt?.toDate?.() || new Date(b.addedAt || 0);
                        return dateB - dateA;
                    }) : [];

                    setWishlistItems(sortedProducts);
                } else {
                    setError(error || 'Failed to load wishlist');
                    showError(error || 'Failed to load wishlist');
                }
            } catch (err) {
                console.error('Error loading wishlist:', err);
                setError('An unexpected error occurred');
                showError('An unexpected error occurred');
            } finally {
                setLoading(false);
            }
        };

        fetchWishlist();
    }, [user, showError]); const handleRemoveFromWishlist = async (productId) => {
        try {
            const { success, error } = await wishlistService.removeFromWishlist(user.uid, productId);

            if (success) {
                // Update local state
                setWishlistItems(prev => prev.filter(item => item.id !== productId));
                showSuccess('Item removed from wishlist');
            } else {
                showError(error || 'Failed to remove item');
            }
        } catch (err) {
            console.error('Error removing from wishlist:', err);
            showError('An unexpected error occurred');
        }
    }; if (!user) {
        return (
            <div className="wishlist-page">
                <div className="wishlist-container">
                    <h1>Wishlist</h1>
                    <p>Please sign in to view your wishlist.</p>
                    <button
                        className="primary-button"
                        onClick={() => navigate('/login', { state: { from: '/wishlist' } })}
                    >
                        Sign In
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="wishlist-page">
            <div className="wishlist-container">
                <h1>My Wishlist</h1>

                {loading ? (
                    <div className="wishlist-loading">
                        <LoadingSpinner />
                    </div>
                ) : error ? (
                    <div className="wishlist-error">
                        <p>{error}</p>
                        <button
                            className="primary-button"
                            onClick={() => window.location.reload()}
                        >
                            Try Again
                        </button>
                    </div>
                ) : wishlistItems.length === 0 ? (
                    <div className="empty-wishlist">
                        <div className="empty-wishlist-message">
                            <h3>Your wishlist is empty</h3>
                            <p>Add items to your wishlist by clicking the heart icon on product pages.</p>
                            <Link to="/shop" className="primary-button">
                                Browse Products
                            </Link>
                        </div>
                    </div>
                ) : (<div className="wishlist-items-grid">
                    {wishlistItems.map((product) => (
                        <div key={product.id} className="wishlist-product-container">
                            <button
                                className="wishlist-remove-button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemoveFromWishlist(product.id);
                                }}
                                title="Remove from wishlist"
                            >
                                <FaTimes />
                            </button>
                            <ProductCard
                                id={product.id}
                                image={product.imageUrl || (product.imageUrls && product.imageUrls[0]) || product.mainImage || 'https://placehold.co/300x300?text=Product'}
                                images={Array.isArray(product.imageUrls) ? product.imageUrls : product.imageUrl ? [product.imageUrl] : []}
                                title={product.name || product.title || 'Unnamed Product'}
                                description={product.description ? product.description.slice(0, 100) + (product.description.length > 100 ? '...' : '') : 'No description available'}
                                price={typeof product.price === 'number' ? product.price : parseFloat(product.price) || 0}
                                rating={typeof product.averageRating === 'number' ? product.averageRating : product.rating || 0}
                                reviewCount={typeof product.reviewCount === 'number' ? product.reviewCount : 0}
                                viewers={typeof product.activeViewers === 'number' ? product.activeViewers : product.viewers || 0}
                                fundingProgress={product.fundingGoal > 0 ? Math.min((product.currentFunding || 0) / product.fundingGoal * 100, 100) : 0}
                                currentFunding={typeof product.currentFunding === 'number' ? product.currentFunding : 0}
                                fundingGoal={typeof product.fundingGoal === 'number' ? product.fundingGoal : 0}
                                status={product.status || 'active'}
                                designerId={product.designerId || ''}
                                onClick={() => navigate(`/product/${product.id}`)}
                            />
                        </div>
                    ))}
                </div>
                )}
            </div>
        </div>
    );
};

export default WishlistPage;