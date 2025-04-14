import React, { useState, useEffect } from 'react';
import { useUser, USER_ROLES } from '../context/UserContext';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, updateDoc, getFirestore } from 'firebase/firestore';
import '../styles/ProfilePage.css';

const ProfilePage = () => {
    const { currentUser, userProfile, userRole, updateUserProfile } = useUser();
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ text: '', type: '' });
    const [profileData, setProfileData] = useState({
        displayName: '',
        bio: '',
        phone: '',
        address: '',
        company: '',
        website: '',
        socialLinks: {
            linkedin: '',
            twitter: '',
            instagram: '',
        },
        preferences: {
            notifications: true,
            newsletter: true,
            marketing: false,
        },
        profilePhoto: '',
        backgroundPhoto: '',
    });

    // Role-specific settings
    const [roleSettings, setRoleSettings] = useState({
        // Admin settings
        admin: {
            accessLevel: 'full',
            canManageUsers: true,
            canManageContent: true,
        },
        // Investor settings
        investor: {
            investmentPreferences: [],
            investmentAmount: '',
            investmentPortfolio: [],
        },
        // Designer settings
        designer: {
            specializations: [],
            portfolio: [],
            availability: 'full-time',
            hourlyRate: '',
        },
        // Manufacturer settings
        manufacturer: {
            facilities: [],
            capabilities: [],
            certifications: [],
            productionCapacity: '',
        },
        // Customer settings
        customer: {
            shippingAddresses: [],
            paymentMethods: [],
            orderPreferences: {
                giftWrapping: false,
                saveShippingInfo: true,
            },
        },
    });

    const storage = getStorage();
    const db = getFirestore();

    // Load user data when component mounts
    useEffect(() => {
        if (userProfile) {
            setProfileData({
                displayName: userProfile.displayName || '',
                bio: userProfile.bio || '',
                phone: userProfile.phone || '',
                address: userProfile.address || '',
                company: userProfile.company || '',
                website: userProfile.website || '',
                socialLinks: userProfile.socialLinks || {
                    linkedin: '',
                    twitter: '',
                    instagram: '',
                },
                preferences: userProfile.preferences || {
                    notifications: true,
                    newsletter: true,
                    marketing: false,
                },
                profilePhoto: userProfile.profilePhoto || '',
                backgroundPhoto: userProfile.backgroundPhoto || '',
            });

            if (userProfile.roleSettings) {
                setRoleSettings(prev => ({
                    ...prev,
                    ...userProfile.roleSettings
                }));
            }
        }
    }, [userProfile]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setProfileData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handlePreferenceChange = (e) => {
        const { name, checked } = e.target;
        setProfileData(prev => ({
            ...prev,
            preferences: {
                ...prev.preferences,
                [name]: checked
            }
        }));
    };

    const handleSocialLinkChange = (e) => {
        const { name, value } = e.target;
        setProfileData(prev => ({
            ...prev,
            socialLinks: {
                ...prev.socialLinks,
                [name]: value
            }
        }));
    };

    const handleRoleSettingChange = (role, setting, value) => {
        setRoleSettings(prev => ({
            ...prev,
            [role]: {
                ...prev[role],
                [setting]: value
            }
        }));
    };

    const handleArraySettingChange = (role, setting, value) => {
        // Split comma-separated string into array
        const arrayValue = value.split(',').map(item => item.trim());
        setRoleSettings(prev => ({
            ...prev,
            [role]: {
                ...prev[role],
                [setting]: arrayValue
            }
        }));
    };

    const handleFileUpload = async (file, field) => {
        if (!file) return null;

        try {
            const storageRef = ref(storage, `users/${currentUser.uid}/${field}/${file.name}`);
            await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(storageRef);
            return downloadURL;
        } catch (error) {
            console.error(`Error uploading ${field}:`, error);
            setMessage({ text: `Error uploading ${field}. Please try again.`, type: 'error' });
            return null;
        }
    };

    const handlePhotoChange = async (e, field) => {
        const file = e.target.files[0];
        if (!file) return;

        // Show preview immediately
        const reader = new FileReader();
        reader.onloadend = () => {
            setProfileData(prev => ({
                ...prev,
                [field]: reader.result // This is for preview only
            }));
        };
        reader.readAsDataURL(file);

        // Store the file for upload on save
        setProfileData(prev => ({
            ...prev,
            [`${field}File`]: file
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage({ text: '', type: '' });

        try {
            let updatedData = { ...profileData };
            delete updatedData.profilePhotoFile;
            delete updatedData.backgroundPhotoFile;

            // Upload photos if they exist
            if (profileData.profilePhotoFile) {
                const profilePhotoURL = await handleFileUpload(profileData.profilePhotoFile, 'profilePhoto');
                if (profilePhotoURL) {
                    updatedData.profilePhoto = profilePhotoURL;
                }
            }

            if (profileData.backgroundPhotoFile) {
                const backgroundPhotoURL = await handleFileUpload(profileData.backgroundPhotoFile, 'backgroundPhoto');
                if (backgroundPhotoURL) {
                    updatedData.backgroundPhoto = backgroundPhotoURL;
                }
            }

            // Add role-specific settings
            updatedData.roleSettings = roleSettings;

            // Update in Firestore
            const success = await updateUserProfile(updatedData);

            if (success) {
                setMessage({ text: 'Profile updated successfully!', type: 'success' });
            } else {
                setMessage({ text: 'Failed to update profile. Please try again.', type: 'error' });
            }
        } catch (error) {
            console.error('Error updating profile:', error);
            setMessage({ text: 'An error occurred. Please try again.', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    // Render role-specific settings based on current user role
    const renderRoleSettings = () => {
        switch (userRole) {
            case USER_ROLES.ADMIN:
                return (
                    <div className="settings-section">
                        <h3>Admin Settings</h3>
                        <div className="form-group">
                            <label>Access Level:</label>
                            <select
                                value={roleSettings.admin.accessLevel}
                                onChange={(e) => handleRoleSettingChange('admin', 'accessLevel', e.target.value)}
                            >
                                <option value="full">Full Access</option>
                                <option value="limited">Limited Access</option>
                                <option value="readonly">Read Only</option>
                            </select>
                        </div>
                        <div className="form-group checkbox">
                            <input
                                type="checkbox"
                                id="canManageUsers"
                                checked={roleSettings.admin.canManageUsers}
                                onChange={(e) => handleRoleSettingChange('admin', 'canManageUsers', e.target.checked)}
                            />
                            <label htmlFor="canManageUsers">Can Manage Users</label>
                        </div>
                        <div className="form-group checkbox">
                            <input
                                type="checkbox"
                                id="canManageContent"
                                checked={roleSettings.admin.canManageContent}
                                onChange={(e) => handleRoleSettingChange('admin', 'canManageContent', e.target.checked)}
                            />
                            <label htmlFor="canManageContent">Can Manage Content</label>
                        </div>
                    </div>
                );

            case USER_ROLES.INVESTOR:
                return (
                    <div className="settings-section">
                        <h3>Investor Settings</h3>
                        <div className="form-group">
                            <label>Investment Preferences (comma separated):</label>
                            <input
                                type="text"
                                value={roleSettings.investor.investmentPreferences.join(', ')}
                                onChange={(e) => handleArraySettingChange('investor', 'investmentPreferences', e.target.value)}
                                placeholder="Real Estate, Tech, Renewable Energy"
                            />
                        </div>
                        <div className="form-group">
                            <label>Investment Amount Range:</label>
                            <input
                                type="text"
                                value={roleSettings.investor.investmentAmount}
                                onChange={(e) => handleRoleSettingChange('investor', 'investmentAmount', e.target.value)}
                                placeholder="$10,000 - $50,000"
                            />
                        </div>
                        <div className="form-group">
                            <label>Current Portfolio (comma separated):</label>
                            <textarea
                                value={roleSettings.investor.investmentPortfolio.join(', ')}
                                onChange={(e) => handleArraySettingChange('investor', 'investmentPortfolio', e.target.value)}
                                placeholder="Company A, Project B, Startup C"
                            />
                        </div>
                    </div>
                );

            case USER_ROLES.DESIGNER:
                return (
                    <div className="settings-section">
                        <h3>Designer Settings</h3>
                        <div className="form-group">
                            <label>Specializations (comma separated):</label>
                            <input
                                type="text"
                                value={roleSettings.designer.specializations.join(', ')}
                                onChange={(e) => handleArraySettingChange('designer', 'specializations', e.target.value)}
                                placeholder="Interior, Furniture, Lighting"
                            />
                        </div>
                        <div className="form-group">
                            <label>Portfolio Links (comma separated):</label>
                            <textarea
                                value={roleSettings.designer.portfolio.join(', ')}
                                onChange={(e) => handleArraySettingChange('designer', 'portfolio', e.target.value)}
                                placeholder="https://example.com/project1, https://example.com/project2"
                            />
                        </div>
                        <div className="form-group">
                            <label>Availability:</label>
                            <select
                                value={roleSettings.designer.availability}
                                onChange={(e) => handleRoleSettingChange('designer', 'availability', e.target.value)}
                            >
                                <option value="full-time">Full Time</option>
                                <option value="part-time">Part Time</option>
                                <option value="contract">Contract</option>
                                <option value="not-available">Not Available</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Hourly Rate (if applicable):</label>
                            <input
                                type="text"
                                value={roleSettings.designer.hourlyRate}
                                onChange={(e) => handleRoleSettingChange('designer', 'hourlyRate', e.target.value)}
                                placeholder="$75/hour"
                            />
                        </div>
                    </div>
                );

            case USER_ROLES.MANUFACTURER:
                return (
                    <div className="settings-section">
                        <h3>Manufacturer Settings</h3>
                        <div className="form-group">
                            <label>Facilities (comma separated):</label>
                            <input
                                type="text"
                                value={roleSettings.manufacturer.facilities.join(', ')}
                                onChange={(e) => handleArraySettingChange('manufacturer', 'facilities', e.target.value)}
                                placeholder="New York, Shanghai, London"
                            />
                        </div>
                        <div className="form-group">
                            <label>Manufacturing Capabilities (comma separated):</label>
                            <textarea
                                value={roleSettings.manufacturer.capabilities.join(', ')}
                                onChange={(e) => handleArraySettingChange('manufacturer', 'capabilities', e.target.value)}
                                placeholder="Wood Furniture, Metal Fabrication, Plastic Injection"
                            />
                        </div>
                        <div className="form-group">
                            <label>Certifications (comma separated):</label>
                            <input
                                type="text"
                                value={roleSettings.manufacturer.certifications.join(', ')}
                                onChange={(e) => handleArraySettingChange('manufacturer', 'certifications', e.target.value)}
                                placeholder="ISO 9001, Fair Trade, Eco-Friendly"
                            />
                        </div>
                        <div className="form-group">
                            <label>Production Capacity:</label>
                            <input
                                type="text"
                                value={roleSettings.manufacturer.productionCapacity}
                                onChange={(e) => handleRoleSettingChange('manufacturer', 'productionCapacity', e.target.value)}
                                placeholder="500 units/week"
                            />
                        </div>
                    </div>
                );

            case USER_ROLES.CUSTOMER:
                return (
                    <div className="settings-section">
                        <h3>Customer Settings</h3>
                        <div className="form-group">
                            <label>Shipping Addresses:</label>
                            <textarea
                                value={roleSettings.customer.shippingAddresses.join('\n')}
                                onChange={(e) => handleArraySettingChange('customer', 'shippingAddresses', e.target.value.replace(/\n/g, ', '))}
                                placeholder="123 Main St, New York, NY 10001"
                            />
                            <button
                                type="button"
                                className="add-button"
                                onClick={() => {
                                    // Add new empty address field
                                    setRoleSettings(prev => ({
                                        ...prev,
                                        customer: {
                                            ...prev.customer,
                                            shippingAddresses: [...prev.customer.shippingAddresses, '']
                                        }
                                    }));
                                }}
                            >
                                + Add Address
                            </button>
                        </div>
                        <div className="form-group checkbox">
                            <input
                                type="checkbox"
                                id="giftWrapping"
                                checked={roleSettings.customer.orderPreferences.giftWrapping}
                                onChange={(e) => setRoleSettings(prev => ({
                                    ...prev,
                                    customer: {
                                        ...prev.customer,
                                        orderPreferences: {
                                            ...prev.customer.orderPreferences,
                                            giftWrapping: e.target.checked
                                        }
                                    }
                                }))}
                            />
                            <label htmlFor="giftWrapping">Default to Gift Wrapping</label>
                        </div>
                        <div className="form-group checkbox">
                            <input
                                type="checkbox"
                                id="saveShippingInfo"
                                checked={roleSettings.customer.orderPreferences.saveShippingInfo}
                                onChange={(e) => setRoleSettings(prev => ({
                                    ...prev,
                                    customer: {
                                        ...prev.customer,
                                        orderPreferences: {
                                            ...prev.customer.orderPreferences,
                                            saveShippingInfo: e.target.checked
                                        }
                                    }
                                }))}
                            />
                            <label htmlFor="saveShippingInfo">Save Shipping Information</label>
                        </div>
                    </div>
                );

            default:
                return null;
        }
    };

    return (
        <div className="profile-page">
            <div
                className="profile-header"
                style={{ backgroundImage: profileData.backgroundPhoto ? `url(${profileData.backgroundPhoto})` : 'none' }}
            >
                <div className="profile-photo-container">
                    {profileData.profilePhoto && (
                        <img src={profileData.profilePhoto} alt="Profile" className="profile-photo" />
                    )}
                    <label className="photo-upload-button">
                        <span>+</span>
                        <input
                            type="file"
                            onChange={(e) => handlePhotoChange(e, 'profilePhoto')}
                            accept="image/*"
                            hidden
                        />
                    </label>
                </div>
                <div className="background-upload">
                    <label className="upload-button">
                        Change Cover Photo
                        <input
                            type="file"
                            onChange={(e) => handlePhotoChange(e, 'backgroundPhoto')}
                            accept="image/*"
                            hidden
                        />
                    </label>
                </div>
            </div>

            {message.text && (
                <div className={`message ${message.type}`}>
                    {message.text}
                </div>
            )}

            <form onSubmit={handleSubmit} className="profile-form">
                <div className="profile-content">
                    <div className="settings-section">
                        <h3>Basic Information</h3>
                        <div className="form-group">
                            <label>Name:</label>
                            <input
                                type="text"
                                name="displayName"
                                value={profileData.displayName}
                                onChange={handleInputChange}
                                placeholder="Your Name"
                            />
                        </div>
                        <div className="form-group">
                            <label>Bio:</label>
                            <textarea
                                name="bio"
                                value={profileData.bio}
                                onChange={handleInputChange}
                                placeholder="Tell us about yourself..."
                            />
                        </div>
                        <div className="form-group">
                            <label>Phone:</label>
                            <input
                                type="tel"
                                name="phone"
                                value={profileData.phone}
                                onChange={handleInputChange}
                                placeholder="Your Phone Number"
                            />
                        </div>
                        <div className="form-group">
                            <label>Address:</label>
                            <textarea
                                name="address"
                                value={profileData.address}
                                onChange={handleInputChange}
                                placeholder="Your Address"
                            />
                        </div>
                    </div>

                    <div className="settings-section">
                        <h3>Professional Information</h3>
                        <div className="form-group">
                            <label>Company/Organization:</label>
                            <input
                                type="text"
                                name="company"
                                value={profileData.company}
                                onChange={handleInputChange}
                                placeholder="Your Company"
                            />
                        </div>
                        <div className="form-group">
                            <label>Website:</label>
                            <input
                                type="url"
                                name="website"
                                value={profileData.website}
                                onChange={handleInputChange}
                                placeholder="https://example.com"
                            />
                        </div>
                        <div className="form-group">
                            <label>LinkedIn:</label>
                            <input
                                type="url"
                                name="linkedin"
                                value={profileData.socialLinks.linkedin}
                                onChange={handleSocialLinkChange}
                                placeholder="https://linkedin.com/in/yourprofile"
                            />
                        </div>
                        <div className="form-group">
                            <label>Twitter:</label>
                            <input
                                type="url"
                                name="twitter"
                                value={profileData.socialLinks.twitter}
                                onChange={handleSocialLinkChange}
                                placeholder="https://twitter.com/yourusername"
                            />
                        </div>
                        <div className="form-group">
                            <label>Instagram:</label>
                            <input
                                type="url"
                                name="instagram"
                                value={profileData.socialLinks.instagram}
                                onChange={handleSocialLinkChange}
                                placeholder="https://instagram.com/yourusername"
                            />
                        </div>
                    </div>

                    <div className="settings-section">
                        <h3>Account Preferences</h3>
                        <div className="form-group checkbox">
                            <input
                                type="checkbox"
                                id="notifications"
                                name="notifications"
                                checked={profileData.preferences.notifications}
                                onChange={handlePreferenceChange}
                            />
                            <label htmlFor="notifications">Receive Notifications</label>
                        </div>
                        <div className="form-group checkbox">
                            <input
                                type="checkbox"
                                id="newsletter"
                                name="newsletter"
                                checked={profileData.preferences.newsletter}
                                onChange={handlePreferenceChange}
                            />
                            <label htmlFor="newsletter">Subscribe to Newsletter</label>
                        </div>
                        <div className="form-group checkbox">
                            <input
                                type="checkbox"
                                id="marketing"
                                name="marketing"
                                checked={profileData.preferences.marketing}
                                onChange={handlePreferenceChange}
                            />
                            <label htmlFor="marketing">Receive Marketing Emails</label>
                        </div>
                    </div>

                    {/* Render role-specific settings */}
                    {renderRoleSettings()}

                    {/* Current Role Display */}
                    <div className="settings-section role-display">
                        <h3>Current Role</h3>
                        <div className="current-role">
                            {userRole ? userRole.charAt(0).toUpperCase() + userRole.slice(1) : 'Loading...'}
                        </div>
                    </div>
                </div>

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
        </div>
    );
};

export default ProfilePage;
