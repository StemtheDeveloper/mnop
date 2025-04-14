import React from 'react';
import { Link } from 'react-router-dom';

const ProductsPage = () => {
    return (
        <div style={{
            padding: '160px 20px 60px',
            maxWidth: '1200px',
            margin: '0 auto',
            textAlign: 'center'
        }}>
            <h1>Products Page</h1>
            <p>This is a placeholder for the products catalog.</p>
            <Link to="/shop" style={{
                display: 'inline-block',
                marginTop: '20px',
                padding: '10px 20px',
                background: '#ffd108',
                color: 'black',
                textDecoration: 'none',
                borderRadius: '4px'
            }}>
                Back to Shop
            </Link>
        </div>
    );
};

export default ProductsPage;
