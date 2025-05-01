import React, { useEffect, useState } from 'react';
import './LoadingSpinner.css';

// Create a global tracking mechanism to prevent multiple spinners
const spinnerInstances = new Map();
// Track spinners by page/context to prevent duplicates in the same view
const contextSpinners = new Map();

const LoadingSpinner = ({
  size = 'medium',
  text = 'Loading...',
  showText = false,
  overlay = false,
  fullPage = false,
  inline = false,
  componentId = 'global', // Default to global tracking
  context = window.location.pathname // Default to current page path as context
}) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Use component-specific tracking if componentId is provided
    const trackingKey = componentId;
    // Create a compound key for context tracking (page + component)
    const contextKey = `${context}-${componentId}`;

    // Initialize counters if needed
    if (!spinnerInstances.has(trackingKey)) {
      spinnerInstances.set(trackingKey, 0);
    }

    if (!contextSpinners.has(contextKey)) {
      contextSpinners.set(contextKey, 0);
    }

    // Increment counters
    spinnerInstances.set(
      trackingKey,
      spinnerInstances.get(trackingKey) + 1
    );

    contextSpinners.set(
      contextKey,
      contextSpinners.get(contextKey) + 1
    );

    // Only show spinner if this is the first instance for this component AND context
    setVisible(
      spinnerInstances.get(trackingKey) === 1 &&
      contextSpinners.get(contextKey) === 1
    );

    // Cleanup when component unmounts
    return () => {
      // Decrement counters
      spinnerInstances.set(
        trackingKey,
        Math.max(0, spinnerInstances.get(trackingKey) - 1)
      );

      contextSpinners.set(
        contextKey,
        Math.max(0, contextSpinners.get(contextKey) - 1)
      );
    };
  }, [componentId, context]);

  // Don't render if another spinner is already showing for this component or context
  if (!visible) return null;

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
