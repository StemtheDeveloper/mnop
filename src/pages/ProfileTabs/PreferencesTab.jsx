import React, { useState, useEffect } from 'react';
import { updateDoc, doc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useUser } from '../../context/UserContext';

const PreferencesTab = () => {
  const { currentUser, userProfile } = useUser();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [formData, setFormData] = useState({
    notifications: true,
    emailPreferences: {
      productUpdates: true,
      orderStatuses: true,
      marketingEmails: false,
      newsletterSubscription: true
    }
  });

  // Fetch user data
  useEffect(() => {
    if (userProfile) {
      setFormData({
        ...formData,
        notifications: userProfile.notifications !== false,
        emailPreferences: {
          ...formData.emailPreferences,
          ...(userProfile.emailPreferences || {})
        }
      });
    }
  }, [userProfile]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    if (name.includes('.')) {
      // Handle nested properties like emailPreferences.productUpdates
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
    if (e) e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      // Update the Firestore profile
      await updateDoc(doc(db, 'users', currentUser.uid), {
        notifications: formData.notifications,
        emailPreferences: formData.emailPreferences,
        updatedAt: new Date()
      });

      setMessage({ type: 'success', text: 'Preferences updated successfully!' });
    } catch (error) {
      console.error("Error updating preferences:", error);
      setMessage({ type: 'error', text: 'Failed to update preferences. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const handleManageEmailPreferences = () => {
    // This could open a modal or navigate to a detailed email preferences page
    console.log("Open email preferences management");
    // For now, we'll just toggle a few common email preferences in the UI
    setFormData({
      ...formData,
      emailPreferences: {
        ...formData.emailPreferences,
        showEmailPreferencesDetails: !formData.emailPreferences.showEmailPreferencesDetails
      }
    });
  };

  return (<div className="settings-section">
    <h3>Preferences</h3>

    {message.text && (
      <div className={`alert ${message.type === 'success' ? 'alert-success' : 'alert-danger'}`}>
        {message.text}
      </div>
    )}

    <div className="form-group checkbox">
      <input
        type="checkbox"
        id="notifications"
        name="notifications"
        checked={formData.notifications}
        onChange={handleChange} />
      <label htmlFor="notifications">Receive email notifications</label>
    </div>

    <div className="form-group">
      <label>Email Preferences</label>
      <p>Manage your email preferences and subscriptions.</p>
      <button
        type="button"
        className="add-button"
        onClick={handleManageEmailPreferences}
      >
        Manage Email Preferences
      </button>

      {formData.emailPreferences.showEmailPreferencesDetails && (
        <div className="email-preferences-details">
          <div className="form-group checkbox">
            <input
              type="checkbox"
              id="emailPreferences.productUpdates"
              name="emailPreferences.productUpdates"
              checked={formData.emailPreferences.productUpdates}
              onChange={handleChange} />
            <label htmlFor="emailPreferences.productUpdates">Product updates and announcements</label>
          </div>

          <div className="form-group checkbox">
            <input
              type="checkbox"
              id="emailPreferences.orderStatuses"
              name="emailPreferences.orderStatuses"
              checked={formData.emailPreferences.orderStatuses}
              onChange={handleChange} />
            <label htmlFor="emailPreferences.orderStatuses">Order status notifications</label>
          </div>

          <div className="form-group checkbox">
            <input
              type="checkbox"
              id="emailPreferences.marketingEmails"
              name="emailPreferences.marketingEmails"
              checked={formData.emailPreferences.marketingEmails}
              onChange={handleChange} />
            <label htmlFor="emailPreferences.marketingEmails">Marketing emails and promotions</label>
          </div>

          <div className="form-group checkbox">
            <input
              type="checkbox"
              id="emailPreferences.newsletterSubscription"
              name="emailPreferences.newsletterSubscription"
              checked={formData.emailPreferences.newsletterSubscription}
              onChange={handleChange} />
            <label htmlFor="emailPreferences.newsletterSubscription">Newsletter subscription</label>
          </div>
        </div>
      )}
    </div>

    <div className="form-actions">
      <button
        type="submit"
        className="submit-button"
        onClick={handleSubmit}
        disabled={loading}
      >
        {loading ? 'Saving...' : 'Save Changes'}
      </button>
    </div>
  </div>);
};

export default PreferencesTab;
