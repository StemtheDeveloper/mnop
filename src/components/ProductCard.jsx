import React from 'react';
import './ProductCard.css';

const ProductCard = ({ image, title, description, price, rating, reviewCount, viewers }) => {
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
