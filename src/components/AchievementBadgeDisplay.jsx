import React from 'react';
import './AchievementBadgeDisplay.css';

const AchievementBadgeDisplay = ({ badge }) => {
  return (
    <div className="achievement-badge-display">
      <img src={badge.image} alt={badge.name} className="badge-image" />
      <div className="badge-info">
        <h4>{badge.name}</h4>
        <p>{badge.description}</p>
      </div>
    </div>
  );
};

export default AchievementBadgeDisplay;
