import React, { useState, useEffect, useRef } from 'react';
import { useUser } from '../context/UserContext';
import { updateProfile } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db, storage } from '../config/firebase';
import '../styles/ProfilePage.css';
import '../styles/ImageCropper.css';
import ImageCropper from '../components/ImageCropper';
import { Link, useParams } from 'react-router-dom';
import AchievementBadgeDisplay from '../components/AchievementBadgeDisplay';

const ProfilePage = () => {
    const { currentUser, userProfile, updateUserProfile, userRole, addUserRole } = useUser();
    const [activeTab, setActiveTab] = useState('personal');
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
        notifications: true,
    });
    const [requestedRole, setRequestedRole] = useState('');
    const [processingRoleRequest, setProcessingRoleRequest] = useState(false);

    // Refs for file inputs
    const profilePhotoRef = useRef(null);
    const headerPhotoRef = useRef(null);

    // State for image files and URLs
    const [profilePhotoFile, setProfilePhotoFile] = useState(null);
    const [headerPhotoURL, setHeaderPhotoURL] = useState('');

    // State for cropping
    const [showProfileCropper, setShowProfileCropper] = useState(false);
    const [showHeaderCropper, setShowHeaderCropper] = useState(false);
    const [cropImageSrc, setCropImageSrc] = useState('');

    // Temporary preview states
    const [profilePhotoPreview, setProfilePhotoPreview] = useState('');

    // Load user data into form
    useEffect(() => {
        if (userProfile) {
            setFormData({
                displayName: userProfile.displayName || '',
                email: currentUser?.email || '',
                phone: userProfile.phone || '',
                bio: userProfile.bio || '',
                location: userProfile.location || '',
                website: userProfile.website || '',
                birthday: userProfile.birthday || '',
                notifications: userProfile.notifications !== false,
            });
            setHeaderPhotoURL(userProfile.headerPhotoURL || '');
        }
    }, [userProfile, currentUser]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData({
            ...formData,
            [name]: type === 'checkbox' ? checked : value,
        });
    };

    const handleProfilePhotoClick = () => {
        profilePhotoRef.current.click();
    };

    const handleHeaderPhotoClick = () => {
        headerPhotoRef.current.click();
    };

    // Handle profile photo selection
    const handleProfilePhotoChange = (e) => {
        if (e.target.files[0]) {
            const file = e.target.files[0];

            // Validate file size (max 5MB)
            if (file.size > 5 * 1024 * 1024) {
                setMessage({ type: 'error', text: 'File size exceeds 5MB limit' });
                return;
            }

            // Validate file type
            if (!file.type.match('image.*')) {
                setMessage({ type: 'error', text: 'Only image files are allowed' });
                return;
            }

            // Create URL for the cropper
            const imageUrl = URL.createObjectURL(file);
            setCropImageSrc(imageUrl);
            setShowProfileCropper(true);
        }
    };

    // Handle header photo selection
    const handleHeaderPhotoChange = (e) => {
        if (e.target.files[0]) {
            const file = e.target.files[0];

            // Validate file size (max 5MB)
            if (file.size > 5 * 1024 * 1024) {
                setMessage({ type: 'error', text: 'File size exceeds 5MB limit' });
                return;
            }

            // Validate file type
            if (!file.type.match('image.*')) {
                setMessage({ type: 'error', text: 'Only image files are allowed' });
                return;
            }

            // Create URL for the cropper
            const imageUrl = URL.createObjectURL(file);
            setCropImageSrc(imageUrl);
            setShowHeaderCropper(true);
        }
    };

    // Handle profile photo crop completion
    const handleProfileCropComplete = async (blob) => {
        try {
            setShowProfileCropper(false);

            // Create a File from the blob
            const croppedFile = new File([blob], 'profile-photo.jpg', { type: 'image/jpeg' });
            setProfilePhotoFile(croppedFile);

            // Create a preview
            const previewUrl = URL.createObjectURL(blob);
            setProfilePhotoPreview(previewUrl);

            // If you want to upload immediately
            await uploadProfilePhoto(croppedFile);

        } catch (error) {
            console.error("Error processing cropped profile photo:", error);
            setMessage({ type: 'error', text: 'Error processing cropped image.' });
        }
    };

    // Handle header photo crop completion
    const handleHeaderCropComplete = async (blob) => {
        try {
            setShowHeaderCropper(false);

            // Create a File from the blob
            const croppedFile = new File([blob], 'header-photo.jpg', { type: 'image/jpeg' });

            // Upload the cropped header photo
            await uploadHeaderPhoto(croppedFile);

        } catch (error) {
            console.error("Error processing cropped header photo:", error);
            setMessage({ type: 'error', text: 'Error processing cropped image.' });
        }
    };

    // Upload profile photo
    const uploadProfilePhoto = async (file) => {
        try {
            setLoading(true);

            const storageRef = ref(storage, `users/${currentUser.uid}/profile`);
            await uploadBytes(storageRef, file);
            const photoURL = await getDownloadURL(storageRef);

            // Update Auth profile
            await updateProfile(auth.currentUser, {
                photoURL: photoURL
            });

            // Update Firestore photoURL
            await updateDoc(doc(db, 'users', currentUser.uid), {
                photoURL: photoURL
            });

            // Clear the file selection
            setProfilePhotoFile(null);

            setMessage({ type: 'success', text: 'Profile photo updated successfully!' });
        } catch (error) {
            console.error("Error uploading profile photo:", error);
            setMessage({ type: 'error', text: 'Failed to upload profile photo. Please try again.' });
        } finally {
            setLoading(false);
        }
    };

    // Upload header photo
    const uploadHeaderPhoto = async (file) => {
        try {
            setLoading(true);

            const storageRef = ref(storage, `users/${currentUser.uid}/header`);
            await uploadBytes(storageRef, file);
            const url = await getDownloadURL(storageRef);

            setHeaderPhotoURL(url);

            // Update user profile in Firestore
            await updateDoc(doc(db, 'users', currentUser.uid), {
                headerPhotoURL: url
            });

            setMessage({ type: 'success', text: 'Header photo updated successfully!' });
        } catch (error) {
            console.error("Error uploading header photo:", error);
            if (error.code === 'storage/unauthorized') {
                setMessage({ type: 'error', text: 'Permission denied: You may need to sign in again' });
            } else if (error.code === 'storage/quota-exceeded') {
                setMessage({ type: 'error', text: 'Storage quota exceeded. Please contact support.' });
            } else if (error.message) {
                setMessage({ type: 'error', text: error.message });
            } else {
                setMessage({ type: 'error', text: 'Failed to update header photo. Please try again.' });
            }
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage({ type: '', text: '' });

        try {
            // Update Firestore profile
            await updateUserProfile({
                displayName: formData.displayName,
                phone: formData.phone,
                bio: formData.bio,
                location: formData.location,
                website: formData.website,
                birthday: formData.birthday,
                notifications: formData.notifications,
            });

            setMessage({ type: 'success', text: 'Profile updated successfully!' });
        } catch (error) {
            console.error("Error updating profile:", error);
            setMessage({ type: 'error', text: 'Failed to update profile. Please try again.' });
        } finally {
            setLoading(false);
        }
    };

    // Add this new function to handle role request
    const handleRoleRequest = async () => {
        if (!requestedRole || processingRoleRequest) return;

        setProcessingRoleRequest(true);
        setMessage({ type: '', text: '' });

        try {
            // Get current roles
            const currentRoles = Array.isArray(userRole) ? userRole : [userRole];

            // Check if user already has the requested role
            if (currentRoles.includes(requestedRole)) {
                setMessage({ type: 'warning', text: `You already have the ${requestedRole} role.` });
                setProcessingRoleRequest(false);
                return;
            }

            // Add the role to the user
            const success = await addUserRole(requestedRole);

            if (success) {
                setMessage({ type: 'success', text: `Successfully added ${requestedRole} role to your account!` });
                setRequestedRole(''); // Reset the dropdown
            } else {
                setMessage({ type: 'error', text: 'Failed to update your role. Please try again.' });
            }
        } catch (error) {
            console.error("Error requesting role:", error);
            setMessage({ type: 'error', text: 'An error occurred while processing your request.' });
        } finally {
            setProcessingRoleRequest(false);
        }
    };

    const getRoleClass = () => {
        if (!userRole) return 'customer-role';

        if (Array.isArray(userRole) && userRole.length > 0) {
            // Use the first role for styling
            return `${userRole[0].toLowerCase()}-role`;
        }

        return typeof userRole === 'string' ? `${userRole.toLowerCase()}-role` : 'customer-role';
    };

    // Function to render role pills
    const renderRolePills = () => {
        if (!userRole) return <div className="role-pill customer">Customer</div>;

        if (Array.isArray(userRole) && userRole.length > 0) {
            return userRole.map((role, index) => (
                <div key={index} className={`role-pill ${role.toLowerCase()}`}>
                    {role.charAt(0).toUpperCase() + role.slice(1)}
                </div>
            ));
        }

        // Single role string case
        const role = typeof userRole === 'string' ? userRole : 'customer';
        return <div className={`role-pill ${role.toLowerCase()}`}>
            {role.charAt(0).toUpperCase() + role.slice(1)}
        </div>;
    };

    const params = useParams();
    const userId = params.id || currentUser?.uid; // Use URL param or current user's ID

    return (
        <div className="profile-page">
            {showProfileCropper && (
                <ImageCropper
                    imageUrl={cropImageSrc}
                    aspect={1}
                    circularCrop={true}
                    onCropComplete={handleProfileCropComplete}
                    onCancel={() => {
                        setShowProfileCropper(false);
                        URL.revokeObjectURL(cropImageSrc);
                    }}
                />
            )}

            {showHeaderCropper && (
                <ImageCropper
                    imageUrl={cropImageSrc}
                    aspect={3 / 1}
                    circularCrop={false}
                    onCropComplete={handleHeaderCropComplete}
                    onCancel={() => {
                        setShowHeaderCropper(false);
                        URL.revokeObjectURL(cropImageSrc);
                    }}
                />
            )}

            <div className="profile-header" style={{
                backgroundImage: headerPhotoURL ? `url(${headerPhotoURL})` : 'none',
                backgroundSize: 'cover',
                backgroundPosition: 'center'
            }}>
                <div className="profile-photo-container">
                    <img
                        src={profilePhotoPreview || currentUser?.photoURL || 'https://via.placeholder.com/120?text=Profile'}
                        alt="Profile"
                        className="profile-photo"
                    />
                    <div className="photo-upload-button" onClick={handleProfilePhotoClick}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                            <circle cx="12" cy="13" r="4"></circle>
                        </svg>
                    </div>
                    <input
                        type="file"
                        ref={profilePhotoRef}
                        onChange={handleProfilePhotoChange}
                        style={{ display: 'none' }}
                        accept="image/*"
                    />
                </div>

                <div className="background-upload">
                    <button className="upload-button" onClick={handleHeaderPhotoClick}>
                        Change Cover
                    </button>
                    <input
                        type="file"
                        ref={headerPhotoRef}
                        onChange={handleHeaderPhotoChange}
                        style={{ display: 'none' }}
                        accept="image/*"
                    />
                </div>
            </div>

            <div className="profile-wrapper">
                <div className="profile-left">
                    <div className="profile-picture-section">
                        <h2>{formData.displayName || 'User'}</h2>
                        <div className="roles-list">
                            {renderRolePills()}
                        </div>
                    </div>

                    <div className="action-buttons">
                        {userRole && Array.isArray(userRole) && userRole.includes('designer') && (
                            <Link to="/upload-product" className="pill-btn">Upload New Design</Link>
                        )}
                        {userRole && Array.isArray(userRole) && userRole.includes('investor') && (
                            <Link to="/portfolio" className="pill-btn">View Investment Portfolio</Link>
                        )}
                        <Link to="/orders" className="pill-btn">My Orders</Link>
                        {userRole && Array.isArray(userRole) && userRole.includes('designer') && (
                            <Link to="/earnings" className="pill-btn earnings">My Earnings</Link>
                        )}
                    </div>
                </div>

                <div className="profile-right">
                    <div className="profile-tabs">
                        <div
                            className={`profile-tab ${activeTab === 'personal' ? 'active' : ''}`}
                            onClick={() => setActiveTab('personal')}
                        >
                            Personal Info
                        </div>
                        <div
                            className={`profile-tab ${activeTab === 'account' ? 'active' : ''}`}
                            onClick={() => setActiveTab('account')}
                        >
                            Account Settings
                        </div>
                        <div
                            className={`profile-tab ${activeTab === 'preferences' ? 'active' : ''}`}
                            onClick={() => setActiveTab('preferences')}
                        >
                            Preferences
                        </div>
                    </div>

                    <div className="profile-content">
                        {message.text && (
                            <div className={`message ${message.type}`}>
                                {message.text}
                            </div>
                        )}

                        <form onSubmit={handleSubmit}>
                            {activeTab === 'personal' && (
                                <div className="settings-section">
                                    <h3>Personal Information</h3>

                                    <div className="form-row">
                                        <div className="form-group form-field-half">
                                            <label htmlFor="displayName">Full Name</label>
                                            <input
                                                type="text"
                                                id="displayName"
                                                name="displayName"
                                                value={formData.displayName}
                                                onChange={handleChange}
                                                placeholder="Your full name"
                                            />
                                        </div>

                                        <div className="form-group form-field-half">
                                            <label htmlFor="email">Email Address</label>
                                            <input
                                                type="email"
                                                id="email"
                                                name="email"
                                                value={formData.email}
                                                readOnly
                                                disabled
                                            />
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
                                                placeholder="Your phone number"
                                            />
                                        </div>

                                        <div className="form-group form-field-half">
                                            <label htmlFor="birthday">Birthday</label>
                                            <input
                                                type="date"
                                                id="birthday"
                                                name="birthday"
                                                value={formData.birthday}
                                                onChange={handleChange}
                                            />
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
                                            placeholder="City, Country"
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label htmlFor="bio">Bio</label>
                                        <textarea
                                            id="bio"
                                            name="bio"
                                            value={formData.bio}
                                            onChange={handleChange}
                                            placeholder="Tell us about yourself"
                                        />
                                    </div>
                                </div>
                            )}

                            {activeTab === 'account' && (
                                <div className="settings-section">
                                    <h3>Account Information</h3>

                                    <div className="form-group">
                                        <label htmlFor="website">Website</label>
                                        <input
                                            type="url"
                                            id="website"
                                            name="website"
                                            value={formData.website}
                                            onChange={handleChange}
                                            placeholder="https://yourwebsite.com"
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label>Account Type</label>
                                        <p>Your account is registered as: <strong>
                                            {Array.isArray(userRole) ? userRole.join(', ') : userRole || 'Customer'}
                                        </strong></p>

                                        <div className="role-upgrade-section">
                                            <label htmlFor="requestRole">Request Additional Role:</label>
                                            <div className="role-upgrade-controls">
                                                <select
                                                    id="requestRole"
                                                    value={requestedRole}
                                                    onChange={(e) => setRequestedRole(e.target.value)}
                                                    className="role-select"
                                                    disabled={processingRoleRequest}
                                                >
                                                    <option value="">Select a role</option>
                                                    <option value="designer">Designer</option>
                                                    <option value="manufacturer">Manufacturer</option>
                                                    <option value="investor">Investor</option>
                                                    <option value="customer">Customer</option>
                                                </select>
                                                <button
                                                    type="button"
                                                    className="role-request-button"
                                                    onClick={handleRoleRequest}
                                                    disabled={!requestedRole || processingRoleRequest}
                                                >
                                                    {processingRoleRequest ? 'Processing...' : 'Request Role'}
                                                </button>
                                            </div>
                                            <p className="role-info">
                                                Adding a new role will give you access to additional features and capabilities.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="form-group">
                                        <label>Account Status</label>
                                        <p>Your account is <strong>Active</strong></p>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'preferences' && (
                                <div className="settings-section">
                                    <h3>Preferences</h3>

                                    <div className="form-group checkbox">
                                        <input
                                            type="checkbox"
                                            id="notifications"
                                            name="notifications"
                                            checked={formData.notifications}
                                            onChange={handleChange}
                                        />
                                        <label htmlFor="notifications">Receive email notifications</label>
                                    </div>

                                    <div className="form-group">
                                        <label>Email Preferences</label>
                                        <p>Manage your email preferences and subscriptions.</p>
                                        <button type="button" className="add-button">
                                            Manage Email Preferences
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div className="form-actions">
                                <button
                                    type="submit"
                                    className="submit-button"
                                    disabled={loading}
                                >
                                    {loading ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        </form>

                        {/* Achievements Section */}
                        <div className="profile-section">
                            <div className="section-header">
                                <h2>Achievements</h2>
                                <Link to={userId ? `/profile/${userId}/achievements` : "/profile/achievements"} className="view-all-link">
                                    View All
                                </Link>

                                <AchievementBadgeDisplay
                                    userId={userId || currentUser?.uid}
                                    showTitle={false}
                                    limit={8}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProfilePage;
