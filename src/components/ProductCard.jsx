import React from 'react';
import './ProductCard.css';

const ProductCard = ({ image, title, description, viewers }) => {
  return (
    <div className="product-card">
      <img src={image} alt={title} className="product-image" />
      <div className="product-info">
        <h3>{title}</h3>
        <p>{description}</p>
        <div className="viewers-indicator">{viewers} viewers online</div>
      </div>
    </div>
  );
};

export default ProductCard;
