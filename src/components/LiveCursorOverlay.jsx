import React from 'react';
import './LiveCursorOverlay.css';

const LiveCursorOverlay = ({ cursors }) => {
  return (
    <div className="live-cursor-overlay">
      {cursors.map((cursor, index) => (
        <div
          key={index}
          className="cursor-icon"
          style={{ left: cursor.x, top: cursor.y }}
          title={cursor.name}
        >
          <img src={cursor.profilePic} alt={cursor.name} />
        </div>
      ))}
    </div>
  );
};

export default LiveCursorOverlay;
