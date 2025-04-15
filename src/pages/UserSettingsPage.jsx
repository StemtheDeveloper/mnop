import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { deleteUser } from 'firebase/auth';
import { auth } from '../config/firebase';
import accountDeletionService from '../services/accountDeletionService';
import '../styles/UserSettingsPage.css';

const UserSettingsPage = () => {
    const { currentUser, userProfile, deleteUserAccount } = useUser();
    const navigate = useNavigate();
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [deleteStep, setDeleteStep] = useState(1);

    // Delete user account and related data
    const handleDeleteAccount = async (e) => {
        e.preventDefault();

        if (!password) {
            setError('Password is required to confirm account deletion');
            return;
        }

        setLoading(true);
        setError('');

        try {
            // Step 1: Re-authenticate the user
            const { success, error } = await deleteUserAccount(password);

            if (!success) {
                throw new Error(error || 'Authentication failed');
            }

            // Move to final confirmation step after successful authentication
            setDeleteStep(2);
            setLoading(false);
            return;
        } catch (error) {
            console.error('Error during re-authentication:', error);
            setError('Incorrect password. Please try again.');
            setLoading(false);
            return;
        }
    };

    // Final deletion step
    const confirmDeleteAccount = async () => {
        setLoading(true);
        setError('');

        try {
            // Step 2: Delete user data from Firestore
            const { success, error } = await accountDeletionService.deleteUserData(currentUser.uid);

            if (!success) {
                throw new Error(error || 'Failed to delete user data');
            }

            // Step 3: Delete the Firebase Authentication account
            await deleteUser(currentUser);

            // Redirect to home page after successful deletion
            navigate('/', {
                state: {
                    message: 'Your account has been successfully deleted. We\'re sorry to see you go!'
                }
            });
        } catch (error) {
            console.error('Error deleting account:', error);
            setError(`Failed to delete account: ${error.message}`);
            setLoading(false);
        }
    };

    // Cancel deletion process
    const cancelDelete = () => {
        setShowDeleteConfirm(false);
        setPassword('');
        setError('');
        setDeleteStep(1);
    };

    return (
        <div className="user-settings-page">
            <div className="settings-container">
                <h1>Account Settings</h1>

                <div className="settings-section">
                    <h2>Personal Information</h2>
                    <p>Manage your account details and preferences</p>

                    <div className="user-info">
                        <p><strong>Email:</strong> {currentUser?.email}</p>
                        <p><strong>Name:</strong> {userProfile?.displayName || 'Not set'}</p>
                        <p><strong>Account created:</strong> {userProfile?.createdAt ? new Date(userProfile.createdAt.seconds * 1000).toLocaleDateString() : 'Unknown'}</p>
                    </div>

                    {/* More settings options can be added here */}
                </div>

                <div className="danger-zone">
                    <h2>Danger Zone</h2>

                    {!showDeleteConfirm ? (
                        <div className="delete-account-section">
                            <p>Permanently delete your account and all your data</p>
                            <button
                                className="delete-button"
                                onClick={() => setShowDeleteConfirm(true)}
                            >
                                Delete Account
                            </button>
                        </div>
                    ) : (
                        <div className="delete-confirmation">
                            <h3>Delete Your Account</h3>

                            {deleteStep === 1 ? (
                                <form onSubmit={handleDeleteAccount}>
                                    <p className="warning">
                                        <strong>Warning:</strong> This action cannot be undone. All your data will be permanently deleted.
                                    </p>

                                    <div className="form-group">
                                        <label htmlFor="password">Enter your password to confirm:</label>
                                        <input
                                            type="password"
                                            id="password"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            required
                                            className="form-input"
                                        />
                                    </div>

                                    {error && <p className="error-message">{error}</p>}

                                    <div className="button-group">
                                        <button
                                            type="button"
                                            className="cancel-button"
                                            onClick={cancelDelete}
                                            disabled={loading}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            className="confirm-button"
                                            disabled={loading || !password}
                                        >
                                            {loading ? 'Verifying...' : 'Continue'}
                                        </button>
                                    </div>
                                </form>
                            ) : (
                                <div className="final-confirmation">
                                    <p className="warning">
                                        <strong>Final Warning:</strong> You are about to delete your account and all associated data.
                                    </p>
                                    <p>This includes your profile, orders, comments, and all other personal data.</p>
                                    <p>Are you absolutely sure you want to proceed?</p>

                                    {error && <p className="error-message">{error}</p>}

                                    <div className="button-group">
                                        <button
                                            type="button"
                                            className="cancel-button"
                                            onClick={cancelDelete}
                                            disabled={loading}
                                        >
                                            No, Keep My Account
                                        </button>
                                        <button
                                            type="button"
                                            className="delete-button final"
                                            onClick={confirmDeleteAccount}
                                            disabled={loading}
                                        >
                                            {loading ? 'Deleting Account...' : 'Yes, Delete My Account'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default UserSettingsPage;
