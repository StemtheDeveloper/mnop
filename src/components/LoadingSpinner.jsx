import React from 'react';
import './LoadingSpinner.css';

const LoadingSpinner = ({
  size = 'medium',
  text = 'Loading...',
  showText = false,
  overlay = false,
  fullPage = false,
  inline = false
}) => {
  // Determine spinner CSS classes based on props
  const spinnerClasses = `spinner spinner-${size}`;
  const containerClasses = `loading-spinner ${overlay ? 'loading-overlay' : ''} ${fullPage ? 'full-page' : ''} ${inline ? 'inline' : ''}`;

  return (
    <div className={containerClasses}>
      <div className="spinner-content">
        <div className={spinnerClasses}></div>
        {showText && <div className="loading-text">{text}</div>}
      </div>
    </div>
  );
};

export default LoadingSpinner;
