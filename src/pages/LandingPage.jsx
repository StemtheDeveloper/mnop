import React from 'react';
import { Link } from 'react-router-dom';

function LandingPage() {
  return (
    <div>
      <h1>Welcome to M'NOP</h1>
      <p>Connecting designers, manufacturers, and investors.</p>
      <Link to="/signin">Sign In</Link>
      <Link to="/register">Register</Link>
      <div>
        <h2>Featured Products</h2>
        {/* Highlights of featured products or success stories */}


      </div>
    </div>
  );
}

export default LandingPage;
