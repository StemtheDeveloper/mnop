import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import './AchievementBadgeDisplay.css';

const AchievementBadgeDisplay = ({ userId, showTitle = true, limit = null, showAll = false }) => {
  const [achievements, setAchievements] = useState([]);
  const [loading, setLoading] = useState(true);
  const { currentUser } = useUser();

  // Display modes:
  // 1. For profile page: Show title, all badges
  // 2. For navbar: No title, limited badges
  // 3. For achievement page: Show title, all badges, detailed view

  useEffect(() => {
    const fetchAchievements = async () => {
      try {
        setLoading(true);

        // Get the user's achievements
        const userRef = collection(db, 'users');
        const userDoc = query(userRef, where('uid', '==', userId || currentUser?.uid));
        const userSnapshot = await getDocs(userDoc);

        if (userSnapshot.empty) {
          setLoading(false);
          return;
        }

        const userData = userSnapshot.docs[0].data();
        const userAchievements = userData.achievements || [];

        if (userAchievements.length === 0) {
          setLoading(false);
          setAchievements([]);
          return;
        }

        // Get achievement details
        const achievementsRef = collection(db, 'achievements');
        const achievementsSnapshot = await getDocs(achievementsRef);

        const achievementsData = achievementsSnapshot.docs
          .filter(doc => userAchievements.includes(doc.id))
          .map(doc => ({
            id: doc.id,
            ...doc.data()
          }));

        // Sort by earned date if available
        achievementsData.sort((a, b) => {
          // If achievement has earnedDate, use it for sorting
          if (a.earnedDate && b.earnedDate) {
            return b.earnedDate.seconds - a.earnedDate.seconds;
          }

          // Otherwise sort by rarity or just by name
          if (a.tier && b.tier) {
            return b.tier - a.tier;
          }

          return a.name.localeCompare(b.name);
        });

        setAchievements(achievementsData);
      } catch (error) {
        console.error('Error fetching achievements:', error);
      } finally {
        setLoading(false);
      }
    };

    if (userId || currentUser) {
      fetchAchievements();
    }
  }, [userId, currentUser]);

  // Display a subset of achievements if limit is provided
  const displayedAchievements = limit && !showAll ? achievements.slice(0, limit) : achievements;
  const hasMoreAchievements = limit && achievements.length > limit;

  if (loading) {
    return (
      <div className="achievement-badges-loading">
        <div className="badge-loader"></div>
      </div>
    );
  }

  if (achievements.length === 0) {
    return null;
  }

  return (
    <div className="achievement-badges-container">
      {showTitle && <h3 className="achievements-title">Achievements</h3>}

      <div className="achievement-badges">        {displayedAchievements.map((achievement, index) => (
        <div
          key={`${achievement.id}-${index}`}
          className={`achievement-badge tier-${achievement.tier || 1}`}
          title={`${achievement.name}: ${achievement.description}`}
        >
          {achievement.icon ? (
            <span className="achievement-icon">{achievement.icon}</span>
          ) : (
            <span className="achievement-icon-fallback">{achievement.name.charAt(0)}</span>
          )}
        </div>
      ))}

        {hasMoreAchievements && (
          <Link
            to={userId ? `/profile/${userId}/achievements` : "/profile/achievements"}
            className="more-achievements-badge"
          >
            +{achievements.length - limit}
          </Link>
        )}
      </div>
    </div>
  );
};

export default AchievementBadgeDisplay;
