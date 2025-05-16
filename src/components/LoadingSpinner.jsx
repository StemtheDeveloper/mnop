import React, { useEffect, useState, memo } from 'react';
import '../styles/components/LoadingSpinner.css';

// Create a global tracking mechanism to prevent multiple spinners
const spinnerInstances = new Map();

const LoadingSpinner = ({
  size = 'medium',
  text = 'Loading...',
  showText = false,
  overlay = false,
  fullPage = false,
  inline = false,
  componentId = 'global' // Default to global tracking
}) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Use component-specific tracking if componentId is provided
    const trackingKey = componentId;

    // Initialize counter for this component if needed
    if (!spinnerInstances.has(trackingKey)) {
      spinnerInstances.set(trackingKey, 0);
    }

    // Increment counter
    spinnerInstances.set(
      trackingKey,
      spinnerInstances.get(trackingKey) + 1
    );

    // Only show spinner if this is the first instance for this component
    setVisible(spinnerInstances.get(trackingKey) === 1);

    // Cleanup when component unmounts
    return () => {
      // Decrement counter
      spinnerInstances.set(
        trackingKey,
        Math.max(0, spinnerInstances.get(trackingKey) - 1)
      );
    };
  }, [componentId]);

  // Don't render if another spinner is already showing for this component
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

// Memoize the component with a custom comparison function
const areEqual = (prevProps, nextProps) => {
  return (
    prevProps.size === nextProps.size &&
    prevProps.text === nextProps.text &&
    prevProps.showText === nextProps.showText &&
    prevProps.overlay === nextProps.overlay &&
    prevProps.fullPage === nextProps.fullPage &&
    prevProps.inline === nextProps.inline &&
    prevProps.componentId === nextProps.componentId
  );
};

export default memo(LoadingSpinner, areEqual);
