import React from 'react';
import { useUser } from '../context/UserContext';
import './ProductCard.css';

const ProductCard = ({
  image,
  title,
  description,
  price,
  rating = 0,
  reviewCount = 0,
  viewers = 0,
  fundingProgress = 0,
  fundingGoal = 0,
  status,
  designerId
}) => {
  const { currentUser } = useUser();

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

  return (
    <div className="product-card">
      {showPendingStatus && (
        <div className="product-pending-badge">Pending Approval</div>
      )}

      <div className="product-image">
        <img src={image} alt={title} />

        {viewers > 0 && (
          <div className="active-viewers">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
            {viewers}
          </div>
        )}
      </div>

      <div className="product-info">
        <h3 className="product-title">{title}</h3>
        <p className="product-description">{description}</p>

        {fundingGoal > 0 && (
          <div className="product-funding">
            <div className="funding-progress-bar">
              <div
                className="progress"
                style={{ width: `${Math.min(fundingProgress, 100)}%` }}
              ></div>
            </div>
            <div className="funding-text">
              <span>{Math.round(fundingProgress)}% funded</span>
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
