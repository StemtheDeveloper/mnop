import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useUser } from '../context/UserContext';
import LoadingSpinner from '../components/LoadingSpinner';
import verificationService from '../services/verificationService';
import '../styles/AdminVerificationPage.css';

const AdminVerificationPage = () => {
  const { userId, role } = useParams();
  const { currentUser, hasRole } = useUser();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);
  
  // Check if the role is valid
  const isValidRole = ['manufacturer', 'designer'].includes(role);
  
  // Fetch user data on component mount
  useEffect(() => {
    const fetchUser = async () => {
      if (!userId || !isValidRole) {
        setError('Invalid user ID or role');
        setLoading(false);
        return;
      }
      
      try {
        const userRef = doc(db, 'users', userId);
        const userDoc = await getDoc(userRef);
        
        if (!userDoc.exists()) {
          setError('User not found');
          setLoading(false);
          return;
        }
        
        setUser({
          id: userDoc.id,
          ...userDoc.data()
        });
        
        setLoading(false);
      } catch (err) {
        console.error('Error fetching user:', err);
        setError('Failed to load user data');
        setLoading(false);
      }
    };
    
    fetchUser();
  }, [userId, isValidRole]);
  
  // Verify the user
  const handleVerify = async () => {
    setProcessing(true);
    setError(null);
    setSuccess(null);
    
    try {
      const isCurrentlyVerified = user[`${role}Verified`] === true;
      const result = await verificationService.verifyUser(userId, role, !isCurrentlyVerified);
      
      if (result.success) {
        setSuccess(result.message);
        
        // Update the local user state to reflect the change
        setUser(prev => ({
          ...prev,
          [`${role}Verified`]: !isCurrentlyVerified
        }));
      } else {
        setError(result.error || 'Failed to update verification status');
      }
    } catch (err) {
      console.error('Error verifying user:', err);
      setError(err.message || 'An error occurred while updating verification status');
    } finally {
      setProcessing(false);
    }
  };
  
  // Go back to user profile
  const handleBack = () => {
    navigate(`/profile/${userId}`);
  };
  
  // If the current user is not an admin, show access denied
  if (!currentUser || !hasRole('admin')) {
    return (
      <div className="admin-verification-page">
        <div className="verification-container">
          <h1>Access Denied</h1>
          <p>You do not have permission to access this page.</p>
          <button onClick={() => navigate('/')} className="back-button">
            Return to Home
          </button>
        </div>
      </div>
    );
  }
  
  // Show loading spinner while fetching data
  if (loading) {
    return (
      <div className="admin-verification-page">
        <div className="verification-container">
          <LoadingSpinner />
          <p>Loading user data...</p>
        </div>
      </div>
    );
  }
  
  // Show error if there is one
  if (error && !user) {
    return (
      <div className="admin-verification-page">
        <div className="verification-container">
          <h1>Error</h1>
          <p className="error-message">{error}</p>
          <button onClick={() => navigate('/admin')} className="back-button">
            Return to Admin Dashboard
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="admin-verification-page">
      <div className="verification-container">
        <h1>User Verification</h1>
        
        {user && (
          <div className="user-info">
            <div className="user-header">
              <img 
                src={user.photoURL || 'https://placehold.co/100x100?text=User'} 
                alt={user.displayName || 'User'} 
                className="user-avatar"
              />
              <div className="user-details">
                <h2>{user.displayName || 'User'}</h2>
                <p className="user-email">{user.email}</p>
                
                <div className="verification-status">
                  <span>Current Status: </span>
                  {user[`${role}Verified`] ? (
                    <span className="verified-badge">Verified {role.charAt(0).toUpperCase() + role.slice(1)}</span>
                  ) : (
                    <span className="unverified-badge">Not Verified</span>
                  )}
                </div>
              </div>
            </div>
            
            {/* Roles */}
            <div className="user-roles">
              <h3>User Roles</h3>
              <div className="roles-list">
                {Array.isArray(user.roles) && user.roles.map((r, index) => (
                  <span key={index} className={`role-badge ${r}`}>
                    {r.charAt(0).toUpperCase() + r.slice(1)}
                  </span>
                ))}
                {!Array.isArray(user.roles) && user.role && (
                  <span className={`role-badge ${user.role}`}>
                    {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                  </span>
                )}
              </div>
            </div>
            
            {error && <p className="error-message">{error}</p>}
            {success && <p className="success-message">{success}</p>}
            
            <div className="action-buttons">
              <button 
                onClick={handleVerify} 
                className={`verification-button ${user[`${role}Verified`] ? 'revoke-button' : 'verify-button'}`}
                disabled={processing}
              >
                {processing ? 'Processing...' : (user[`${role}Verified`] ? `Revoke ${role} Verification` : `Verify as ${role}`)}
              </button>
              
              <button onClick={handleBack} className="back-button" disabled={processing}>
                Back to Profile
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminVerificationPage;