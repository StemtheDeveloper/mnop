import React from 'react';
import { Link } from 'react-router-dom';

const CheckoutPage = () => {
    return (
        <div style={{
            padding: '160px 20px 60px',
            maxWidth: '800px',
            margin: '0 auto',
            textAlign: 'center'
        }}>
            <h1>Checkout Page</h1>
            <p>This is a placeholder for the checkout functionality.</p>
            <Link to="/cart" style={{
                display: 'inline-block',
                marginTop: '20px',
                padding: '10px 20px',
                background: '#3f97d3',
                color: 'white',
                textDecoration: 'none',
                borderRadius: '4px'
            }}>
                Return to Cart
            </Link>
        </div>
    );
};

export default CheckoutPage;
