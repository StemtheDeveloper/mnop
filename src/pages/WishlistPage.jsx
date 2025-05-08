import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { useToast } from '../contexts/ToastContext';
import wishlistService from '../services/wishlistService';
import LoadingSpinner from '../components/LoadingSpinner';
import '../styles/WishlistPage.css';

const WishlistPage = () => {
    const { currentUser } = useUser();
    const { success: showSuccess, error: showError } = useToast();
    const navigate = useNavigate();

    const [wishlistItems, setWishlistItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Fetch wishlist data
    useEffect(() => {
        const fetchWishlist = async () => {
            if (!currentUser) {
                return;
            }

            setLoading(true);
            setError(null);

            try {
                const { success, data, error } = await wishlistService.getUserWishlist(currentUser.uid);

                if (success) {
                    // Sort products by when they were added (newest first)
                    const sortedProducts = data.products ? [...data.products].sort((a, b) => {
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
    }, [currentUser, showError]);

    const handleRemoveFromWishlist = async (productId) => {
        try {
            const { success, error } = await wishlistService.removeFromWishlist(currentUser.uid, productId);

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
    };

    if (!currentUser) {
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
                ) : (
                    <div className="wishlist-items">
                        {wishlistItems.map((item) => (
                            <div key={item.id} className="wishlist-item">
                                <div className="wishlist-item-image">
                                    {item.imageUrl ? (
                                        <img src={item.imageUrl} alt={item.name} />
                                    ) : (
                                        <div className="no-image">No Image</div>
                                    )}
                                </div>
                                <div className="wishlist-item-details">
                                    <h3>
                                        <Link to={`/product/${item.id}`}>{item.name}</Link>
                                    </h3>
                                    <p className="wishlist-item-price">${item.price?.toFixed(2) || '0.00'}</p>
                                </div>
                                <div className="wishlist-item-actions">
                                    <button
                                        className="view-button"
                                        onClick={() => navigate(`/product/${item.id}`)}
                                    >
                                        View Product
                                    </button>
                                    <button
                                        className="remove-button"
                                        onClick={() => handleRemoveFromWishlist(item.id)}
                                    >
                                        Remove
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default WishlistPage;