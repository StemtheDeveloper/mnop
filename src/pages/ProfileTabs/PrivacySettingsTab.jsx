import React, { useState, useEffect } from 'react';
import { updateDoc, doc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useUser } from '../../context/UserContext';

const PrivacySettingsTab = () => {
  const { currentUser, userProfile } = useUser();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [formData, setFormData] = useState({
    privacy: {
      showRole: true,
      showBio: true,
      showLocation: true,
      showWebsite: true,
      showBirthday: false,
      showProducts: true
    }
  });

  // Fetch user data
  useEffect(() => {
    if (userProfile) {
      setFormData({
        ...formData,
        privacy: {
          ...formData.privacy,
          ...(userProfile.privacy || {})
        }
      });
    }
  }, [userProfile]);

  const handleChange = (e) => {
    const { name, checked } = e.target;

    if (name.includes('.')) {
      // Handle nested properties like privacy.showBio
      const [parent, child] = name.split('.');
      setFormData({
        ...formData,
        [parent]: {
          ...formData[parent],
          [child]: checked
        }
      });
    }
  };

  const handlePrivacySubmit = async () => {
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      // Update Firestore profile privacy settings
      await updateDoc(doc(db, 'users', currentUser.uid), {
        privacy: formData.privacy,
        updatedAt: new Date()
      });

      setMessage({ type: 'success', text: 'Privacy settings updated successfully!' });
    } catch (error) {
      console.error("Error updating privacy settings:", error);
      setMessage({ type: 'error', text: 'Failed to update privacy settings. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  return (<div className="settings-section privacy-settings-section">
    <h3>Privacy Settings</h3>
    <p>Control what information visitors can see on your profile</p>

    {message.text && (
      <div className={`alert ${message.type === 'success' ? 'alert-success' : 'alert-danger'}`}>
        {message.text}
      </div>
    )}

    <div className="form-group checkbox">
      <input
        type="checkbox"
        id="showRole"
        name="privacy.showRole"
        checked={formData.privacy.showRole}
        onChange={handleChange} />
      <label htmlFor="showRole">Show my roles</label>
    </div>

    <div className="form-group checkbox">
      <input
        type="checkbox"
        id="showBio"
        name="privacy.showBio"
        checked={formData.privacy.showBio}
        onChange={handleChange} />
      <label htmlFor="showBio">Show my bio</label>
    </div>

    <div className="form-group checkbox">
      <input
        type="checkbox"
        id="showLocation"
        name="privacy.showLocation"
        checked={formData.privacy.showLocation}
        onChange={handleChange} />
      <label htmlFor="showLocation">Show my location</label>
    </div>

    <div className="form-group checkbox">
      <input
        type="checkbox"
        id="showWebsite"
        name="privacy.showWebsite"
        checked={formData.privacy.showWebsite}
        onChange={handleChange} />
      <label htmlFor="showWebsite">Show my website</label>
    </div>

    <div className="form-group checkbox">
      <input
        type="checkbox"
        id="showBirthday"
        name="privacy.showBirthday"
        checked={formData.privacy.showBirthday}
        onChange={handleChange} />
      <label htmlFor="showBirthday">Show my birthday</label>
    </div>

    <div className="form-group checkbox">
      <input
        type="checkbox"
        id="showProducts"
        name="privacy.showProducts"
        checked={formData.privacy.showProducts}
        onChange={handleChange} />
      <label htmlFor="showProducts">Show my products</label>
    </div>

    <div className="form-actions">
      <button
        type="button"
        className="submit-button"
        onClick={handlePrivacySubmit}
        disabled={loading}
      >
        {loading ? 'Saving...' : 'Save Privacy Settings'}
      </button>
    </div>
  </div>);
};

export default PrivacySettingsTab;
