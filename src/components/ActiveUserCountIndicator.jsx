import React from 'react';
import './ActiveUserCountIndicator.css';

const ActiveUserCountIndicator = ({ count }) => {
  return (
    <div className="active-user-count-indicator">
      {count} users online
    </div>
  );
};

export default ActiveUserCountIndicator;
