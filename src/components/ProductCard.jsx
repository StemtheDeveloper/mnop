import React, { useState, useEffect, useRef } from 'react';
import { useUser } from '../context/UserContext';
import { doc, updateDoc, arrayUnion, arrayRemove, getDoc, query, where, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '../contexts/ToastContext';
import '../styles/ProductCard.css';

const ProductCard = ({
  id,
  image,
  images = [],  // New prop to accept multiple images
  title,
  description,
  price,
  rating = 0,
  reviewCount = 0,
  viewers = 0,
  fundingProgress = 0,
  fundingGoal = 0,
  currentFunding = 0,
  status,
  designerId,
  onClick
}) => {
  const { currentUser } = useUser();
  const { success: showSuccess, error: showError } = useToast(); // Map to correct function names
  const [isLiked, setIsLiked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isHovering, setIsHovering] = useState(false);
  const [buttonAnimation, setButtonAnimation] = useState('');
  const imageInterval = useRef(null);

  // Process images prop
  const imageList = Array.isArray(images) && images.length > 0
    ? images
    : image ? [image] : ['https://placehold.co/300x300?text=Product'];

  // Combine single image and images array, ensuring no duplicates
  const allImages = images.length > 0
    ? images
    : image ? [image] : ['https://via.placeholder.com/300'];

  // Calculate funding percentage
  const fundingPercentage = fundingGoal > 0
    ? Math.min((currentFunding / fundingGoal) * 100, 100)
    : fundingProgress;

  // Determine if product is fully funded
  const isFullyFunded = fundingPercentage >= 100;

  // Format price as currency
  const formatPrice = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(value);
  };

  // Check if the current user is the designer of this product
  const isProductDesigner = currentUser && designerId === currentUser.uid;

  // Show pending status only to the product designer
  const showPendingStatus = isProductDesigner && status === 'pending';

  // Handle like button click
  const handleLikeClick = async (e) => {
    e.preventDefault(); // Prevent navigating to product details
    e.stopPropagation(); // Stop event propagation

    if (!currentUser) {
      showError("Please sign in to like products");
      return;
    }

    // Optimistically update UI immediately for better responsiveness
    const newLikedState = !isLiked;
    setIsLiked(newLikedState);
    
    setIsLoading(true);

    try {
      const userRef = doc(db, 'users', currentUser.uid);
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) {
        throw new Error("User document not found");
      }

      const userData = userDoc.data();
      const likedProducts = userData.likedProducts || [];
      const isCurrentlyLiked = likedProducts.includes(id);

      // Toggle like status for the user
      await updateDoc(userRef, {
        likedProducts: isCurrentlyLiked
          ? arrayRemove(id)
          : arrayUnion(id)
      });

      // Get the current product data
      const productRef = doc(db, 'products', id);
      const productDoc = await getDoc(productRef);
      
      if (!productDoc.exists()) {
        throw new Error("Product document not found");
      }
      
      const productData = productDoc.data();
      const currentLikes = productData.likesCount || 0;
      
      // Calculate new like count based on whether we're adding or removing a like
      let newLikeCount;
      if (isCurrentlyLiked) {
        // If user already liked it, they're removing their like
        newLikeCount = Math.max(0, currentLikes - 1);
      } else {
        // If user hasn't liked it yet, they're adding a like
        newLikeCount = currentLikes + 1;
      }

      // Update product likes count correctly
      await updateDoc(productRef, {
        likesCount: newLikeCount
      });

      showSuccess(isCurrentlyLiked ? "Removed from favorites" : "Added to favorites");

    } catch (error) {
      console.error("Error updating like status:", error);
      showError("Failed to update favorites");
      // Revert optimistic UI update if there was an error
      setIsLiked(!newLikedState);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle add to cart
  const handleAddToCart = async (e) => {
    e.preventDefault(); // Prevent navigating to product details
    e.stopPropagation(); // Stop event propagation

    if (!currentUser) {
      showError("Please sign in to add items to cart");
      return;
    }

    // Check if product is fully funded
    if (fundingGoal > 0 && !isFullyFunded) {
      showError("This product needs to be fully funded before purchase");
      return;
    }

    // Start animation
    setButtonAnimation('animate-add-to-cart');
    setIsLoading(true);

    try {
      // Check if user has a cart
      const cartsRef = collection(db, 'carts');
      const cartQuery = query(cartsRef, where('userId', '==', currentUser.uid));
      const cartSnapshot = await getDocs(cartQuery);

      // Use the first image from allImages array instead of just the image prop
      const imageUrl = allImages[0] || 'https://placehold.co/300x300?text=Product';

      if (cartSnapshot.empty) {
        // Create a new cart
        const cartData = {
          userId: currentUser.uid,
          items: [{
            id,
            name: title,
            price,
            imageUrl: imageUrl,
            quantity: 1
          }],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };

        await addDoc(cartsRef, cartData);
      } else {
        // Update existing cart
        const cartDoc = cartSnapshot.docs[0];
        const cartData = cartDoc.data();
        const items = cartData.items || [];

        // Check if product already in cart
        const existingItem = items.find(item => item.id === id);

        if (existingItem) {
          // Increase quantity
          existingItem.quantity += 1;

          await updateDoc(doc(db, 'carts', cartDoc.id), {
            items,
            updatedAt: serverTimestamp()
          });
        } else {
          // Add new item
          await updateDoc(doc(db, 'carts', cartDoc.id), {
            items: [...items, {
              id,
              name: title,
              price,
              imageUrl: imageUrl,
              quantity: 1
            }],
            updatedAt: serverTimestamp()
          });
        }
      }

      // Show success notification with product details
      showSuccess(`Added to cart: ${title} (${formatPrice(price)})`);
    } catch (error) {
      console.error("Error adding to cart:", error);
      showError("Failed to add to cart");
    } finally {
      setIsLoading(false);
      // Reset animation after a delay
      setTimeout(() => setButtonAnimation(''), 700);
    }
  };

  // Check if product is currently liked by user
  useEffect(() => {
    const checkLikeStatus = async () => {
      if (!currentUser || !id) return;

      try {
        const userRef = doc(db, 'users', currentUser.uid);
        const userDoc = await getDoc(userRef);

        if (userDoc.exists()) {
          const userData = userDoc.data();
          const likedProducts = userData.likedProducts || [];
          const isCurrentlyLiked = likedProducts.includes(id);

          // Only update state if the liked status has changed
          if (isLiked !== isCurrentlyLiked) {
            setIsLiked(isCurrentlyLiked);
          }
        }
      } catch (error) {
        console.error("Error checking like status:", error);
      }
    };

    checkLikeStatus();
  }, [currentUser, id, isLiked]);

  // Handle image cycling on hover
  useEffect(() => {
    if (isHovering && allImages.length > 1) {
      imageInterval.current = setInterval(() => {
        setCurrentImageIndex(prevIndex => (prevIndex + 1) % allImages.length);
      }, 2000); // Change image every 2 seconds
    } else {
      clearInterval(imageInterval.current);
    }

    return () => clearInterval(imageInterval.current);
  }, [isHovering, allImages.length]);

  return (
    <div className="product-card" onClick={onClick}>
      {showPendingStatus && (
        <div className="product-pending-badge">Pending Approval</div>
      )}

      <div
        className="product-image"
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => {
          setIsHovering(false);
          setCurrentImageIndex(0); // Reset to first image when mouse leaves
        }}
      >
        <img src={allImages[currentImageIndex]} alt={title} />

        {/* Image indicators - only show when there are multiple images */}
        {allImages.length > 1 && (
          <div className="image-indicators">
            {allImages.map((_, index) => (
              <span
                key={index}
                className={`image-indicator ${currentImageIndex === index ? 'active' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentImageIndex(index);
                }}
              ></span>
            ))}
          </div>
        )}

        {/* Navigation arrows - only show when there are multiple images */}
        {allImages.length > 1 && (
          <>
            <button
              className="image-nav-button prev"
              aria-label="Previous image"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault(); // Prevent default action
                const newIndex = currentImageIndex === 0 ? allImages.length - 1 : currentImageIndex - 1;
                setCurrentImageIndex(newIndex);
                // Clear auto-cycling interval when manually navigating
                if (imageInterval.current) {
                  clearInterval(imageInterval.current);
                  imageInterval.current = null;
                }
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6"></polyline>
              </svg>
            </button>
            <button
              className="image-nav-button next"
              aria-label="Next image"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault(); // Prevent default action
                const newIndex = currentImageIndex === allImages.length - 1 ? 0 : currentImageIndex + 1;
                setCurrentImageIndex(newIndex);
                // Clear auto-cycling interval when manually navigating
                if (imageInterval.current) {
                  clearInterval(imageInterval.current);
                  imageInterval.current = null;
                }
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </button>
          </>
        )}

        {viewers > 0 && (
          <div className="active-viewers">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
            {viewers}
          </div>
        )}

        <div className="product-actions">
          <button
            className={`like-button ${isLiked ? 'liked' : ''}`}
            onClick={handleLikeClick}
            disabled={isLoading}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill={isLiked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
            </svg>
          </button>

          <button
            className={`add-to-cart-button ${fundingGoal > 0 && !isFullyFunded ? 'disabled' : ''} ${buttonAnimation}`}
            onClick={handleAddToCart}
            disabled={isLoading || (fundingGoal > 0 && !isFullyFunded)}
            title={fundingGoal > 0 && !isFullyFunded ? "Product needs to be fully funded" : "Add to cart"}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="21" r="1"></circle>
              <circle cx="20" cy="21" r="1"></circle>
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
            </svg>
          </button>
        </div>
      </div>

      <div className="product-info">
        <h3 className="product-title">{title}</h3>
        <p className="product-description">{description}</p>

        {fundingGoal > 0 && (
          <div className="product-funding">
            <div className="funding-progress-bar">
              <div
                className="progress"
                style={{ width: `${Math.min(fundingPercentage, 100)}%` }}
              ></div>
            </div>
            <div className="funding-text">
              <span>{Math.round(fundingPercentage)}% funded</span>
              <span className="funding-goal">{formatPrice(fundingGoal)} goal</span>
            </div>
          </div>
        )}

        <div className="product-meta">
          <div className="product-price">{formatPrice(price)}</div>

          {rating > 0 && (
            <div className="product-rating">
              <span className="star">★</span>
              <span>{rating.toFixed(1)}</span>
              {reviewCount > 0 && (
                <span className="review-count">({reviewCount})</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
