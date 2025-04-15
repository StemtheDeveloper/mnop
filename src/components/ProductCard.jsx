import React from 'react';
import './ProductCard.css';

const ProductCard = ({ image, title, description, price, rating, reviewCount, viewers, fundingProgress, fundingGoal }) => {
  // Function to render stars based on rating
  const renderStars = (rating) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;

    // Add full stars
    for (let i = 0; i < fullStars; i++) {
      stars.push(<span key={`full-${i}`} className="star full">★</span>);
    }

    // Add half star if needed
    if (hasHalfStar) {
      stars.push(<span key="half" className="star half">★</span>);
    }

    // Add empty stars
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
    for (let i = 0; i < emptyStars; i++) {
      stars.push(<span key={`empty-${i}`} className="star empty">☆</span>);
    }

    return stars;
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(price);
  };

  // Calculate funding progress percentage with bounds checking
  const progressPercentage = Math.min(Math.max(fundingProgress || 0, 0), 100);

  return (
    <div className="product-card">
      <div className="product-image">
        <img src={image} alt={title} />
        {viewers > 0 && (
          <div className="viewers-indicator">{viewers} viewing</div>
        )}
      </div>
      <div className="product-info">
        <h3>{title}</h3>
        <div className="product-price">{formatPrice(price)}</div>
        <p>{description}</p>

        {/* Funding progress bar */}
        {fundingGoal > 0 && (
          <div className="funding-container">
            <div className="funding-progress">
              <div
                className="funding-bar"
                style={{ width: `${progressPercentage}%` }}
              ></div>
            </div>
            <div className="funding-info">
              <span className="funding-percentage">{Math.round(progressPercentage)}%</span>
              <span className="funding-goal">of {formatPrice(fundingGoal)}</span>
            </div>
          </div>
        )}

        {rating > 0 && (
          <div className="product-rating">
            <div className="stars">{renderStars(rating)}</div>
            <span className="review-count">({reviewCount})</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductCard;
