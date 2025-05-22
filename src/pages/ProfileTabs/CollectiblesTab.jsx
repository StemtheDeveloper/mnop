import React from 'react';
import { useParams } from 'react-router-dom';
import { useUser } from '../../context/UserContext';
import NopCollection from '../../components/NopCollection';

const CollectiblesTab = () => {
  const { currentUser } = useUser();
  const { userId: urlUserId } = useParams();
  const userId = urlUserId || currentUser?.uid;

  return (<div className="settings-section collectibles-section">
    <h3>Your Nop Collection</h3>
    <p>View all the Nops you've collected from the daily Nop feature.</p>

    <NopCollection userId={userId} />

    <div className="collectibles-info">
      <p>Don't forget to check the footer each day for a new collectible Nop!</p>
    </div>
  </div>);
};

export default CollectiblesTab;
