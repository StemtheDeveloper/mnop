import React from 'react';
import { useParams } from 'react-router-dom';
import { useUser } from '../../context/UserContext';

const ReviewsTab = () => {
  const { currentUser } = useUser();
  const { userId: urlUserId } = useParams();
  const userId = urlUserId || currentUser?.uid;
  const isOwnProfile = currentUser && userId === currentUser.uid;

  return (
    <div className="settings-section reviews-section">
      <h3>Reviews</h3>
      <p>
        {isOwnProfile
          ? "See what others have to say about you and your products."
          : "See what others have to say about this user and their products."}
      </p>

      <div className="reviews-coming-soon">
        <p>Reviews feature coming soon!</p>
      </div>
    </div>
  );
};

export default ReviewsTab;
