import React, { useState, useEffect } from 'react';
import { updateDoc, doc } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { db, auth } from '../../config/firebase';
import { useUser } from '../../context/UserContext';
import { useParams } from 'react-router-dom';

const PersonalInfoTab = ({ userId, isOwnProfile }) => {
  const { currentUser, userProfile } = useUser();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [formData, setFormData] = useState({
    displayName: '',
    email: '',
    phone: '',
    bio: '',
    location: '',
    website: '',
    birthday: '',
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
    if (currentUser && userProfile) {
      setFormData({
        ...formData,
        displayName: currentUser.displayName || '',
        email: currentUser.email || '',
        phone: userProfile.phone || '',
        bio: userProfile.bio || '',
        location: userProfile.location || '',
        website: userProfile.website || '',
        birthday: userProfile.birthday || '',
        privacy: userProfile.privacy || formData.privacy
      });
    }
  }, [currentUser, userProfile]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    if (name.includes('.')) {
      // Handle nested properties like privacy.showBio
      const [parent, child] = name.split('.');
      setFormData({
        ...formData,
        [parent]: {
          ...formData[parent],
          [child]: type === 'checkbox' ? checked : value
        }
      });
    } else {
      // Handle regular properties
      setFormData({
        ...formData,
        [name]: type === 'checkbox' ? checked : value
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      // Update the Firestore profile directly using doc and updateDoc
      await updateDoc(doc(db, 'users', currentUser.uid), {
        displayName: formData.displayName,
        phone: formData.phone,
        bio: formData.bio,
        location: formData.location,
        website: formData.website,
        birthday: formData.birthday,
        updatedAt: new Date()
      });

      // If the displayName changed, update the Auth profile as well
      if (formData.displayName !== currentUser.displayName) {
        await updateProfile(auth.currentUser, {
          displayName: formData.displayName
        });
      }

      setMessage({ type: 'success', text: 'Profile updated successfully!' });
    } catch (error) {
      console.error("Error updating profile:", error);
      setMessage({ type: 'error', text: 'Failed to update profile. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const shouldShowField = (fieldName) => {
    // If viewing own profile, always show everything
    if (isOwnProfile) return true;

    // If not viewing own profile, check privacy settings
    // Make sure privacy settings exist and the field is explicitly allowed
    return formData?.privacy?.[fieldName] === true;
  };

  return (<form onSubmit={handleSubmit}>
    <div className="settings-section">
      <h3>Personal Information</h3>
      {message.text && (
        <div className={`alert ${message.type === 'success' ? 'alert-success' : 'alert-danger'}`}>
          {message.text}
        </div>
      )}

      {isOwnProfile ? (
        // Full editable form for the profile owner
        <>
          <div className="form-row">
            <div className="form-group form-field-half">
              <label htmlFor="displayName">Full Name</label>
              <input
                type="text"
                id="displayName"
                name="displayName"
                value={formData.displayName}
                onChange={handleChange}
                placeholder="Your full name" />
            </div>

            <div className="form-group form-field-half">
              <label htmlFor="email">Email Address</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                readOnly
                disabled />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group form-field-half">
              <label htmlFor="phone">Phone Number</label>
              <input
                type="tel"
                id="phone"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="Your phone number" />
            </div>

            <div className="form-group form-field-half">
              <label htmlFor="birthday">Birthday</label>
              <input
                type="date"
                id="birthday"
                name="birthday"
                value={formData.birthday}
                onChange={handleChange} />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="location">Location</label>
            <input
              type="text"
              id="location"
              name="location"
              value={formData.location}
              onChange={handleChange}
              placeholder="City, Country" />
          </div>

          <div className="form-group">
            <label htmlFor="bio">Bio</label>
            <textarea
              id="bio"
              name="bio"
              value={formData.bio}
              onChange={handleChange}
              placeholder="Tell us about yourself" />
          </div>

          <div className="form-group">
            <label htmlFor="website">Website</label>
            <input
              type="url"
              id="website"
              name="website"
              value={formData.website}
              onChange={handleChange}
              placeholder="https://yourwebsite.com" />
          </div>

          <div className="form-actions">
            <button
              type="submit"
              className="submit-button primary-button"
              disabled={loading}
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </>
      ) : (
        // Read-only view for visitors with privacy settings respected
        <div className="profile-view-only">
          <div className="profile-info-item">
            <h4>Name</h4>
            <p>{formData.displayName || 'Not specified'}</p>
          </div>

          {shouldShowField('showBio') && formData.bio && (
            <div className="profile-info-item">
              <h4>Bio</h4>
              <p>{formData.bio}</p>
            </div>
          )}

          {shouldShowField('showLocation') && formData.location && (
            <div className="profile-info-item">
              <h4>Location</h4>
              <p>{formData.location}</p>
            </div>
          )}

          {shouldShowField('showWebsite') && formData.website && (
            <div className="profile-info-item">
              <h4>Website</h4>
              <p><a href={formData.website} target="_blank" rel="noopener noreferrer">{formData.website}</a></p>
            </div>
          )}

          {shouldShowField('showBirthday') && formData.birthday && (
            <div className="profile-info-item">
              <h4>Birthday</h4>
              <p>{new Date(formData.birthday).toLocaleDateString()}</p>
            </div>
          )}
        </div>
      )}
    </div>
  </form>);
};

export default PersonalInfoTab;
