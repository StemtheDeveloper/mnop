import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import wishlistService from '../services/wishlistService';
import { useToast } from '../context/ToastContext';

import HeartIcon from '../assets/Heart.svg';
import UnheartIcon from '../assets/Unheart.svg';

/**
 * WishlistButton component that allows users to add/remove products from their wishlist
 * and to subscribe to back-in-stock notifications.
 * 
 * @param {Object} props
 * @param {string} props.productId - The ID of the product
 * @param {string} props.variantId - The ID of the product variant (if applicable)
 * @param {Object} props.productData - Additional product data (name, image, etc.)
 * @param {boolean} props.inStock - Whether the product is currently in stock
 * @param {string} props.buttonStyle - The style of the button ('icon' or 'button')
 * @param {string} props.size - The size of the button ('small', 'medium', or 'large')
 * @returns {JSX.Element}
 */
const WishlistButton = ({
    productId,
    variantId = null,
    productData = {},
    inStock = true,
    buttonStyle = 'icon',
    size = 'medium'
}) => {
    const { user } = useUser();
    const { showSuccess, showError, showInfo } = useToast();
    const navigate = useNavigate();
    const [isInWishlist, setIsInWishlist] = useState(false);
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [showBackInStockModal, setShowBackInStockModal] = useState(false);

    // Check if the product is in the user's wishlist
    useEffect(() => {
        const checkWishlistStatus = async () => {
            if (user && productId) {
                try {
                    const inWishlist = await wishlistService.isInWishlist(user.uid, productId, variantId);
                    setIsInWishlist(inWishlist);

                    if (!inStock) {
                        const subscribed = await wishlistService.isSubscribedToStockNotifications(
                            user.uid, productId, variantId
                        );
                        setIsSubscribed(subscribed);
                    }
                } catch (error) {
                    console.error('Error checking wishlist status:', error);
                }
            }
        };

        checkWishlistStatus();
    }, [user, productId, variantId, inStock]);

    // Handle wishlist toggle
    const toggleWishlist = async () => {
        if (!user) {
            showInfo('Please sign in to add items to your wishlist');
            navigate('/signin', { state: { from: window.location.pathname } });
            return;
        }

        setIsLoading(true);

        try {
            if (isInWishlist) {
                // Remove from wishlist
                const result = await wishlistService.removeFromWishlist(user.uid, productId, variantId);

                if (result.success) {
                    setIsInWishlist(false);
                    showSuccess('Item removed from wishlist');
                } else {
                    showError('Error removing item from wishlist');
                }
            } else {
                // Add to wishlist
                const result = await wishlistService.addToWishlist(
                    user.uid,
                    productId,
                    variantId,
                    productData
                );

                if (result.success) {
                    setIsInWishlist(true);
                    showSuccess('Item added to wishlist');

                    // If the product is out of stock, prompt for back-in-stock notifications
                    if (!inStock) {
                        setShowBackInStockModal(true);
                    }
                } else {
                    showError('Error adding item to wishlist');
                }
            }
        } catch (error) {
            console.error('Error toggling wishlist:', error);
            showError('An error occurred while updating your wishlist');
        } finally {
            setIsLoading(false);
        }
    };

    // Handle back-in-stock subscription toggle
    const toggleStockSubscription = async () => {
        if (!user) {
            showInfo('Please sign in to subscribe to notifications');
            navigate('/signin', { state: { from: window.location.pathname } });
            return;
        }

        setIsLoading(true);

        try {
            if (isSubscribed) {
                // Unsubscribe
                const result = await wishlistService.unsubscribeFromStockNotifications(
                    user.uid, productId, variantId
                );

                if (result.success) {
                    setIsSubscribed(false);
                    showSuccess('You will no longer receive back-in-stock notifications for this item');
                } else {
                    showError('Error updating notification preferences');
                }
            } else {
                // Subscribe
                const result = await wishlistService.subscribeToStockNotifications(
                    user.uid, productId, variantId, productData
                );

                if (result.success) {
                    setIsSubscribed(true);
                    showSuccess('You will be notified when this item is back in stock');
                } else {
                    showError('Error updating notification preferences');
                }
            }
        } catch (error) {
            console.error('Error toggling stock subscription:', error);
            showError('An error occurred while updating your notification preferences');
        } finally {
            setIsLoading(false);
            setShowBackInStockModal(false);
        }
    };

    // Back in stock modal
    const BackInStockModal = () => (
        <div className="back-in-stock-modal">
            <div className="back-in-stock-modal-content">
                <h3>Get notified when back in stock?</h3>
                <p>This item is currently out of stock. Would you like to receive a notification when it becomes available?</p>
                <div className="back-in-stock-modal-actions">
                    <button
                        className="secondary-button"
                        onClick={() => setShowBackInStockModal(false)}
                    >
                        No, thanks
                    </button>
                    <button
                        className="primary-button"
                        onClick={toggleStockSubscription}
                        disabled={isLoading}
                    >
                        Notify me
                    </button>
                </div>
            </div>
        </div>
    );

    // Render button based on style
    if (buttonStyle === 'icon') {
        return (
            <>
                <button
                    className={`wishlist-icon-button ${size} ${isInWishlist ? 'active' : ''} ${isLoading ? 'loading' : ''}`}
                    onClick={toggleWishlist}
                    aria-label={isInWishlist ? 'Remove from wishlist' : 'Add to wishlist'}
                    disabled={isLoading}
                >
                    <img
                        src={isInWishlist ? HeartIcon : UnheartIcon}
                        alt={isInWishlist ? 'Added to wishlist' : 'Add to wishlist'}
                        className="wishlist-icon"
                    />
                </button>

                {!inStock && isInWishlist && !isSubscribed && (
                    <button
                        className="stock-notification-button"
                        onClick={toggleStockSubscription}
                        disabled={isLoading}
                    >
                        Notify when back in stock
                    </button>
                )}

                {!inStock && isSubscribed && (
                    <button
                        className="stock-notification-button subscribed"
                        onClick={toggleStockSubscription}
                        disabled={isLoading}
                    >
                        Notification enabled
                    </button>
                )}

                {showBackInStockModal && <BackInStockModal />}
            </>
        );
    }

    // Button style
    return (
        <>
            <button
                className={`wishlist-button ${size} ${isInWishlist ? 'active' : ''} ${isLoading ? 'loading' : ''}`}
                onClick={toggleWishlist}
                disabled={isLoading}
            >
                <img
                    src={isInWishlist ? HeartIcon : UnheartIcon}
                    alt={isInWishlist ? 'Added to wishlist' : 'Add to wishlist'}
                    className="wishlist-icon"
                />
                <span>{isInWishlist ? 'In Wishlist' : 'Add to Wishlist'}</span>
            </button>

            {!inStock && (
                <button
                    className={`stock-notification-button ${isSubscribed ? 'subscribed' : ''}`}
                    onClick={toggleStockSubscription}
                    disabled={isLoading}
                >
                    {isSubscribed ? 'Notification enabled' : 'Notify when back in stock'}
                </button>
            )}

            {showBackInStockModal && <BackInStockModal />}
        </>
    );
};

export default WishlistButton;