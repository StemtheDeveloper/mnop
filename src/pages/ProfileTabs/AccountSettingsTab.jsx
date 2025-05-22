import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { doc, updateDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { db, auth, } from '../../config/firebase';
import { useUser } from '../../context/UserContext';
import { useParams } from 'react-router-dom';



const AccountSettingsTab = () => {
  const { currentUser, userProfile } = useUser();
  const { userId } = useParams();
  const isOwnProfile = currentUser && userId === currentUser.uid;

  const [loading, setLoading] = useState(false);
  const [dataExportLoading, setDataExportLoading] = useState(false);
  const [exportFormat, setExportFormat] = useState('json');
  const [exportOptions, setExportOptions] = useState({
    includeOrders: true,
    includeTransactions: true,
    includeProducts: true,
    includeInvestments: true,
    includeMessages: false,
    includeReviews: true
  });
  const [formData, setFormData] = useState({
    website: userProfile?.website || '',
  });

  const hasRole = (role) => {
    return userProfile?.roles?.includes(role) || false;
  };

  const renderRolePills = () => {
    if (!userProfile?.roles || userProfile.roles.length === 0) {
      return <span className="role-pill">Customer</span>;
    }

    return userProfile.roles.map(role => (
      <span key={role} className={`role-pill role-${role.toLowerCase()}`}>
        {role.charAt(0).toUpperCase() + role.slice(1)}
      </span>
    ));
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    if (name.includes('.')) {
      // Handle nested properties
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

  const toggleExportOption = (option) => {
    setExportOptions({
      ...exportOptions,
      [option]: !exportOptions[option]
    });
  };

  const handleDataExport = async () => {
    setDataExportLoading(true);
    try {
      // Implementation of data export would go here
      console.log('Exporting data in format:', exportFormat);
      console.log('With options:', exportOptions);
      // Simulate delay for UI feedback
      await new Promise(resolve => setTimeout(resolve, 1500));
      alert('Data export complete! Your download should begin shortly.');
    } catch (error) {
      console.error('Error exporting data:', error);
      alert('Failed to export data. Please try again.');
    } finally {
      setDataExportLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      // Redirect would typically happen via a listener or router
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleDeleteAccount = async () => {
    const confirmDelete = window.confirm(
      'Are you sure you want to delete your account? This action cannot be undone.'
    );
    if (!confirmDelete) return;

    setLoading(true);
    try {
      // Implementation of account deletion would go here
      alert('Account deletion initiated. You will receive a confirmation email.');
      // After successful deletion, sign the user out
      await signOut(auth);
    } catch (error) {
      console.error('Error deleting account:', error);
      alert('Failed to delete account. Please try again.');
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);

    try {
      await updateDoc(doc(db, 'users', currentUser.uid), {
        website: formData.website,
        updatedAt: new Date()
      });
      alert('Account settings updated successfully!');
    } catch (error) {
      console.error('Error updating account settings:', error);
      alert('Failed to update account settings. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (<div className="settings-section">
    <h3>Account Information</h3>

    <div className="form-group">
      <label htmlFor="website">Website</label>
      <input
        type="url"
        id="website"
        name="website"
        value={formData.website}
        onChange={handleChange}
        placeholder="https://yourwebsite.com" />
    </div>                                    <div className="form-group">
      <label>Account Type</label>
      <div className="account-roles">
        <p>Your account has the following roles:</p>
        <div className="roles-list account-roles-list">
          {renderRolePills()}
        </div>
        <p className="roles-info">
          Settings for all your roles are accessible through the tabs above.
        </p>
        <div className="role-registration-buttons">
          {!hasRole('designer') && (
            <Link to="/register-designer" className="btn-role-registration">
              Register as Designer
            </Link>
          )}
          {!hasRole('manufacturer') && (
            <Link to="/register-manufacturer" className="btn-role-registration">
              Register as Manufacturer
            </Link>
          )}
          {!hasRole('investor') && (
            <Link to="/register-investor" className="btn-role-registration">
              Register as Investor
            </Link>
          )}
        </div>
      </div>
    </div>

    <div className="form-group">
      <label>Account Status</label>
      <p>Your account is <strong>Active</strong></p>
    </div>

    {/* Verification Status Section */}
    <div className="verification-status-section">
      <hr />
      <h4>Verification Status</h4>
      <p>Verified accounts receive a badge and have enhanced credibility in the community.</p>

      {hasRole('designer') && (
        <div className="verification-status-item">
          <div className="verification-info">
            <h5>Designer Verification</h5>
            <p>Verified designers can showcase their authenticity and expertise.</p>
          </div>
          <div className="verification-badge-container">
            {userProfile.designerVerified ? (
              <div className="verification-badge-active">
                <span className="verification-icon">✓</span>
                <span>Verified</span>
              </div>
            ) : userProfile.designerVerificationRequested ? (
              <div className="verification-badge-pending">
                <span>Pending Review</span>
              </div>
            ) : (
              <Link to="/verification-request/designer" className="btn-verification-request">
                Request Verification
              </Link>
            )}
          </div>
        </div>
      )}

      {hasRole('manufacturer') && (
        <div className="verification-status-item">
          <div className="verification-info">
            <h5>Manufacturer Verification</h5>
            <p>Verified manufacturers have proven their manufacturing capabilities and reliability.</p>
          </div>
          <div className="verification-badge-container">
            {userProfile.manufacturerVerified ? (
              <div className="verification-badge-active">
                <span className="verification-icon">✓</span>
                <span>Verified</span>
              </div>
            ) : userProfile.manufacturerVerificationRequested ? (
              <div className="verification-badge-pending">
                <span>Pending Review</span>
              </div>
            ) : (
              <Link to="/verification-request/manufacturer" className="btn-verification-request">
                Request Verification
              </Link>
            )}
          </div>
        </div>
      )}
    </div>

    {/* Data Export Section */}
    <div className="data-export-section">
      <hr />
      <h4>Data Export</h4>
      <p>Download a copy of your personal data for backup or portability</p>

      <div className="export-format-selector">
        <label>Select Export Format:</label>
        <div className="export-format-options">
          <div className="export-format-option">
            <input
              type="radio"
              id="format-json"
              name="exportFormat"
              value="json"
              checked={exportFormat === 'json'}
              onChange={() => setExportFormat('json')}
            />
            <label htmlFor="format-json">JSON (single file)</label>
          </div>
          <div className="export-format-option">
            <input
              type="radio"
              id="format-csv"
              name="exportFormat"
              value="csv"
              checked={exportFormat === 'csv'}
              onChange={() => setExportFormat('csv')}
            />
            <label htmlFor="format-csv">CSV (zip archive with multiple files)</label>
          </div>
        </div>
      </div>

      <div className="export-options">
        <label>Select Data to Include:</label>
        <div className="export-options-grid">
          <div className="form-group checkbox">
            <input
              type="checkbox"
              id="includeOrders"
              checked={exportOptions.includeOrders}
              onChange={() => toggleExportOption('includeOrders')}
            />
            <label htmlFor="includeOrders">Orders History</label>
          </div>
          <div className="form-group checkbox">
            <input
              type="checkbox"
              id="includeTransactions"
              checked={exportOptions.includeTransactions}
              onChange={() => toggleExportOption('includeTransactions')}
            />
            <label htmlFor="includeTransactions">Transaction History</label>
          </div>
          <div className="form-group checkbox">
            <input
              type="checkbox"
              id="includeProducts"
              checked={exportOptions.includeProducts}
              onChange={() => toggleExportOption('includeProducts')}
            />
            <label htmlFor="includeProducts">Products (for designers)</label>
          </div>
          <div className="form-group checkbox">
            <input
              type="checkbox"
              id="includeInvestments"
              checked={exportOptions.includeInvestments}
              onChange={() => toggleExportOption('includeInvestments')}
            />
            <label htmlFor="includeInvestments">Investments (for investors)</label>
          </div>
          <div className="form-group checkbox">
            <input
              type="checkbox"
              id="includeMessages"
              checked={exportOptions.includeMessages}
              onChange={() => toggleExportOption('includeMessages')}
            />
            <label htmlFor="includeMessages">Messages</label>
          </div>
          <div className="form-group checkbox">
            <input
              type="checkbox"
              id="includeReviews"
              checked={exportOptions.includeReviews}
              onChange={() => toggleExportOption('includeReviews')}
            />
            <label htmlFor="includeReviews">Reviews</label>
          </div>
        </div>
      </div>

      <div className="export-actions">
        <button
          type="button"
          className="export-data-btn"
          onClick={handleDataExport}
          disabled={dataExportLoading}
        >
          {dataExportLoading ? 'Exporting...' : 'Download My Data'}
        </button>
        <p className="export-note">
          This may take a few moments depending on the amount of data.
        </p>
      </div>
    </div>

    {/* Security Settings Section */}
    <div className="security-settings">
      <hr />
      <h4>Security Settings</h4>
      <div className="security-options">
        <div className="security-option">
          <div className="security-option-info">
            <h5>Two-Factor Authentication</h5>
            <p>Add an extra layer of security to your account by requiring a verification code when you sign in.</p>
          </div>
          <Link to="/mfa-setup" className="btn-secondary">
            {/* Add optional badge showing if MFA is enabled, if available */}
            {userProfile?.mfaEnabled ? "Manage 2FA" : "Set up 2FA"}
          </Link>
        </div>
      </div>
    </div>

    {isOwnProfile && (
      <div className="account-actions">
        <hr />
        <h4>Account Management</h4>
        <button
          type="button"
          className="button secondary-button logout-button"
          onClick={handleLogout}
          disabled={loading}
        >
          Log Out
        </button>
        <button
          type="button"
          className="button danger-button delete-account-button"
          onClick={handleDeleteAccount}
          disabled={loading}
        >
          {loading ? 'Deleting...' : 'Delete Account'}
        </button>
        <p className="delete-warning">
          Deleting your account is permanent and cannot be undone.
        </p>
      </div>
    )}

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

export default AccountSettingsTab;
