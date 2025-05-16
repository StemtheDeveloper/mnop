import React, { useEffect, useState } from 'react';
import { useUser } from '../context/UserContext';
import { collection, doc, onSnapshot, setDoc, query, where, deleteDoc } from 'firebase/firestore';
import { db } from '../config/firebase';


/**
 * LiveCursorOverlay component shows real-time cursors of other users viewing the same page
 * 
 * @param {Object} props
 * @param {string} props.pageId - Unique identifier for the current page
 * @returns {React.ReactNode}
 */
const LiveCursorOverlay = ({ pageId }) => {
  const [cursors, setCursors] = useState([]);
  const { currentUser, userProfile } = useUser();
  const [localCursorId, setLocalCursorId] = useState(null);

  // Subscribe to other users' cursors and manage local cursor
  useEffect(() => {
    if (!currentUser || !pageId) return;

    // Create a unique ID for this user's cursor on this page
    const cursorId = `${currentUser.uid}-${Date.now()}`;
    setLocalCursorId(cursorId);

    // Setup the cursor document for this user
    const cursorRef = doc(db, 'live_cursors', cursorId);
    const userCursorData = {
      userId: currentUser.uid,
      userName: userProfile?.displayName || 'Anonymous',
      pageId: pageId,
      x: 0,
      y: 0,
      lastActive: new Date(),
      profilePicture: userProfile?.photoURL || null
    };

    // Create initial cursor document
    const initCursor = async () => {
      try {
        await setDoc(cursorRef, userCursorData);
      } catch (error) {
        console.error('Error initializing cursor:', error);
      }
    };

    // Listen for other users' cursors on this page
    const cursorsRef = collection(db, 'live_cursors');
    const cursorsQuery = query(
      cursorsRef,
      where('pageId', '==', pageId),
      where('userId', '!=', currentUser.uid)
    );

    const unsubscribe = onSnapshot(cursorsQuery, (snapshot) => {
      const cursorData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        // Add default values for missing fields
        userName: doc.data().userName || 'Anonymous',
        profilePicture: doc.data().profilePicture || null
      }));

      // Filter out stale cursors (more than 2 minutes old)
      const activeTime = new Date();
      activeTime.setMinutes(activeTime.getMinutes() - 2);

      const activeCursors = cursorData.filter(cursor => {
        if (!cursor.lastActive) return false;
        const lastActive = cursor.lastActive.toDate ?
          cursor.lastActive.toDate() : new Date(cursor.lastActive);
        return lastActive > activeTime;
      });

      setCursors(activeCursors);
    }, (error) => {
      console.error('Error fetching live cursors:', error);
    });

    // Initialize cursor
    initCursor();

    // Track mouse movement to update cursor position
    const handleMouseMove = (e) => {
      // Debounce updates to avoid excessive writes
      if (window.cursorUpdateTimeout) {
        clearTimeout(window.cursorUpdateTimeout);
      }

      window.cursorUpdateTimeout = setTimeout(async () => {
        try {
          // Get cursor position relative to viewport
          const x = e.clientX;
          const y = e.clientY;

          // Update cursor in Firestore
          await setDoc(cursorRef, {
            x,
            y,
            lastActive: new Date()
          }, { merge: true });
        } catch (error) {
          console.error('Error updating cursor position:', error);
        }
      }, 50); // Update every 50ms at most
    };

    // Track user's mouse movement
    document.addEventListener('mousemove', handleMouseMove);

    // Cleanup function
    return () => {
      // Remove event listener
      document.removeEventListener('mousemove', handleMouseMove);

      // Clear any pending updates
      if (window.cursorUpdateTimeout) {
        clearTimeout(window.cursorUpdateTimeout);
      }

      // Remove cursor document when component unmounts
      if (cursorId) {
        deleteDoc(cursorRef).catch(err => {
          console.error('Error deleting cursor:', err);
        });
      }

      // Unsubscribe from real-time updates
      unsubscribe();
    };
  }, [currentUser, pageId, userProfile]);

  // Don't render anything if there are no other cursors
  if (cursors.length === 0) {
    return null;
  }

  return (
    <div className="live-cursor-overlay">
      {cursors.map(cursor => (
        <div
          key={cursor.id}
          className="cursor-pointer"
          style={{
            left: cursor.x,
            top: cursor.y,
            transform: 'translate(-50%, -50%)'
          }}
        >
          <div className="cursor-icon">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M3 3L10.07 19.97L12.58 12.58L19.97 10.07L3 3Z"
                stroke="#ffffff"
                strokeWidth="2"
                fill="#ef3c23"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div className="cursor-info">
            <div className="cursor-avatar">
              {cursor.profilePicture ? (
                <img src={cursor.profilePicture} alt={cursor.userName} />
              ) : (
                <div className="default-avatar">
                  {cursor.userName ? cursor.userName.charAt(0).toUpperCase() : 'A'}
                </div>
              )}
            </div>
            <span className="cursor-name">{cursor.userName}</span>
          </div>
        </div>
      ))}
    </div>
  );
};

export default LiveCursorOverlay;
