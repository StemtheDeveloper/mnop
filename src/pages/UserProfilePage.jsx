import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useUser } from '../context/UserContext';
import '../styles/ProfilePage.css';
import '../styles/UserProfilePage.css';
import LoadingSpinner from '../components/LoadingSpinner';
import AchievementBadgeDisplay from '../components/AchievementBadgeDisplay';
import UserReviewSection from '../components/reviews/UserReviewSection';
import messagingService from '../services/messagingService';

const UserProfilePage = () => {
    const { currentUser, hasRole } = useUser();
    const { userId } = useParams();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [userProfile, setUserProfile] = useState(null);
    const [userProducts, setUserProducts] = useState([]);
    const [loadingProducts, setLoadingProducts] = useState(false);
    const [activeTab, setActiveTab] = useState('about');
    const [error, setError] = useState(null);
    const [sendingMessage, setSendingMessage] = useState(false);

    // Fetch user data
    useEffect(() => {
        const fetchUserProfile = async () => {
            if (!userId) {
                setError('No user ID provided');
                setLoading(false);
                return;
            }

            try {
                const userDocRef = doc(db, 'users', userId);
                const userDoc = await getDoc(userDocRef);

                if (!userDoc.exists()) {
                    setError('User not found');
                    setLoading(false);
                    return;
                }

                setUserProfile({
                    id: userDoc.id,
                    ...userDoc.data()
                });

                setLoading(false);
            } catch (err) {
                console.error('Error fetching user profile:', err);
                setError('Failed to load user profile');
                setLoading(false);
            }
        };

        fetchUserProfile();
    }, [userId]);

    // Fetch user's products if they are a designer
    useEffect(() => {
        const fetchUserProducts = async () => {
            if (!userProfile) return;

            // Check if user has designer role
            const userRoles = Array.isArray(userProfile.roles)
                ? userProfile.roles
                : userProfile.role ? [userProfile.role] : [];

            const isDesigner = userRoles.includes('designer');

            if (!isDesigner) return;

            // Check privacy settings
            if (userProfile.privacy?.showProducts === false && userId !== currentUser?.uid) {
                return;
            }

            setLoadingProducts(true);

            try {
                const productsRef = collection(db, 'products');
                const q = query(productsRef, where('designerId', '==', userId));
                const snapshot = await getDocs(q);

                const products = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));

                // For visitors, only show active products
                const visibleProducts = userId === currentUser?.uid
                    ? products
                    : products.filter(product => product.status === 'active');

                setUserProducts(visibleProducts);
            } catch (error) {
                console.error('Error fetching products:', error);
            } finally {
                setLoadingProducts(false);
            }
        };

        fetchUserProducts();
    }, [userProfile, userId, currentUser]);

    // Check if field should be displayed based on privacy settings
    const shouldShowField = (fieldName) => {
        // If viewing own profile, always show everything
        if (currentUser && userId === currentUser.uid) return true;

        // If not viewing own profile, check privacy settings
        return userProfile?.privacy?.[fieldName] !== false;
    };

    // Format price as currency
    const formatPrice = (price) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(price || 0);
    };

    // Function to render role pills
    const renderRolePills = () => {
        if (!userProfile) return null;

        const roles = Array.isArray(userProfile.roles)
            ? userProfile.roles
            : userProfile.role ? [userProfile.role] : ['customer'];

        return roles.map((role, index) => (
            <div key={index} className={`role-pill ${role.toLowerCase()}`}>
                {role.charAt(0).toUpperCase() + role.slice(1)}
                {/* Show verification badge if user is verified for this role */}
                {role === 'manufacturer' && userProfile.manufacturerVerified && (
                    <span className="verification-badge" title="Verified Manufacturer">✓</span>
                )}
                {/* {role === 'designer' && userProfile.designerVerified && (
                    <span className="verification-badge" title="Verified Designer">✓</span>
                )} */}
            </div>
        ));
    };

    // Handle clicking the message button
    const handleMessageUser = async () => {
        if (!currentUser) {
            navigate('/signin', { state: { from: window.location.pathname } });
            return;
        }

        try {
            setSendingMessage(true);

            // Find or create a conversation between these users
            const conversation = await messagingService.findOrCreateConversation(
                currentUser.uid,
                userId
            );

            // Navigate to the conversation
            navigate(`/messages/${conversation.id}`);
        } catch (err) {
            console.error('Error creating conversation:', err);
            // If there's an error, fall back to the messages page
            navigate('/messages');
        } finally {
            setSendingMessage(false);
        }
    };

    if (loading) {
        return (
            <div className="user-profile-page">
                <div className="loading-container">
                    <LoadingSpinner />
                    <p>Loading user profile...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="user-profile-page">
                <div className="error-container">
                    <h2>Error</h2>
                    <p>{error}</p>
                    <Link to="/" className="btn-primary">Return to Home</Link>
                </div>
            </div>
        );
    }

    if (!userProfile) {
        return (
            <div className="user-profile-page">
                <div className="error-container">
                    <h2>User Not Found</h2>
                    <p>The user profile you're looking for doesn't exist or has been removed.</p>
                    <Link to="/" className="btn-primary">Return to Home</Link>
                </div>
            </div>
        );
    }

    return (
        <div className="user-profile-page">
            <div className="profile-header" style={{
                backgroundImage: userProfile.headerPhotoURL ? `url(${userProfile.headerPhotoURL})` : 'none',
                backgroundSize: 'cover',
                backgroundPosition: 'center'
            }}>
                <div className="profile-photo-container">
                    <img
                        src={userProfile.photoURL || 'https://placehold.co/120x120?text=Profile'}
                        alt={userProfile.displayName || 'User'}
                        className="profile-photo"
                    />
                </div>
            </div>

            <div className="profile-wrapper">
                <div className="profile-left">
                    <div className="profile-picture-section">
                        <h2>
                            {userProfile.displayName || 'User'}
                            {/* Show a verification checkmark next to the user's name if verified in any role */}
                            {(userProfile.manufacturerVerified || userProfile.designerVerified) && (
                                <span className="name-verification-badge" title="Verified Account">✓</span>
                            )}
                        </h2>
                        {shouldShowField('showRole') && (
                            <div className="roles-list">
                                {renderRolePills()}
                            </div>
                        )}
                    </div>

                    <div className="action-buttons">
                        <button
                            className="pill-btn message-button"
                            onClick={handleMessageUser}
                            disabled={sendingMessage}
                        >
                            {sendingMessage ? 'Opening chat...' : 'Message User'}
                        </button>

                        {/* Admin verification controls */}
                        {currentUser && hasRole('admin') && (userId !== currentUser.uid) && (
                            <div className="admin-controls">
                                <h4>Admin Controls</h4>
                                {userProfile.roles?.includes('manufacturer') && (
                                    <button
                                        className={`admin-btn ${userProfile.manufacturerVerified ? 'revoke-btn' : 'verify-btn'}`}
                                        onClick={() => window.location.href = `/admin/verify/${userId}/manufacturer`}
                                    >
                                        {userProfile.manufacturerVerified ? 'Revoke Manufacturer Verification' : 'Verify as Manufacturer'}
                                    </button>
                                )}

                                {userProfile.roles?.includes('designer') && (
                                    <button
                                        className={`admin-btn ${userProfile.designerVerified ? 'revoke-btn' : 'verify-btn'}`}
                                        onClick={() => window.location.href = `/admin/verify/${userId}/designer`}
                                    >
                                        {userProfile.designerVerified ? 'Revoke Designer Verification' : 'Verify as Designer'}
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                <div className="profile-right">
                    <div className="profile-tabs">
                        <div
                            className={`profile-tab ${activeTab === 'about' ? 'active' : ''}`}
                            onClick={() => setActiveTab('about')}
                        >
                            About
                        </div>
                        {userProducts.length > 0 && shouldShowField('showProducts') && (
                            <div
                                className={`profile-tab ${activeTab === 'products' ? 'active' : ''}`}
                                onClick={() => setActiveTab('products')}
                            >
                                Products
                            </div>
                        )}
                        <div
                            className={`profile-tab ${activeTab === 'reviews' ? 'active' : ''}`}
                            onClick={() => setActiveTab('reviews')}
                        >
                            Reviews
                        </div>
                        <div
                            className={`profile-tab ${activeTab === 'achievements' ? 'active' : ''}`}
                            onClick={() => setActiveTab('achievements')}
                        >
                            Achievements
                        </div>
                    </div>

                    <div className="profile-content">
                        {activeTab === 'about' && (
                            <div className="settings-section">
                                <h3>About {userProfile.displayName || 'User'}</h3>

                                <div className="profile-view-only">
                                    {shouldShowField('showBio') && userProfile.bio && (
                                        <div className="profile-info-item">
                                            <h4>Bio</h4>
                                            <p>{userProfile.bio}</p>
                                        </div>
                                    )}

                                    {shouldShowField('showLocation') && userProfile.location && (
                                        <div className="profile-info-item">
                                            <h4>Location</h4>
                                            <p>{userProfile.location}</p>
                                        </div>
                                    )}

                                    {shouldShowField('showWebsite') && userProfile.website && (
                                        <div className="profile-info-item">
                                            <h4>Website</h4>
                                            <p><a href={userProfile.website} target="_blank" rel="noopener noreferrer">{userProfile.website}</a></p>
                                        </div>
                                    )}

                                    {shouldShowField('showBirthday') && userProfile.birthday && (
                                        <div className="profile-info-item">
                                            <h4>Birthday</h4>
                                            <p>{new Date(userProfile.birthday).toLocaleDateString()}</p>
                                        </div>
                                    )}

                                    {/* Display verification status */}
                                    {userProfile.manufacturerVerified && (
                                        <div className="profile-info-item verification-info">
                                            <h4>Verification Status</h4>
                                            <p className="verification-status">
                                                <span className="verification-icon">✓</span>
                                                Verified Manufacturer
                                            </p>
                                        </div>
                                    )}

                                    {userProfile.designerVerified && (
                                        <div className="profile-info-item verification-info">
                                            <h4>Verification Status</h4>
                                            <p className="verification-status">
                                                <span className="verification-icon">✓</span>
                                                Verified Designer
                                            </p>
                                        </div>
                                    )}

                                    {!userProfile.bio && !userProfile.location && !userProfile.website && !userProfile.birthday &&
                                        !userProfile.manufacturerVerified && !userProfile.designerVerified && (
                                            <div className="profile-info-item">
                                                <p className="empty-info">This user hasn't added any information to their profile yet.</p>
                                            </div>
                                        )}
                                </div>
                            </div>
                        )}

                        {activeTab === 'products' && shouldShowField('showProducts') && (
                            <div className="settings-section products-section">
                                <h3>{userProfile.displayName}'s Products</h3>

                                {loadingProducts ? (
                                    <div className="loading-container">
                                        <LoadingSpinner />
                                        <p>Loading products...</p>
                                    </div>
                                ) : userProducts.length === 0 ? (
                                    <div className="empty-state">
                                        <p>This user hasn't uploaded any products yet.</p>
                                    </div>
                                ) : (
                                    <div className="product-grid visitor-view">
                                        {userProducts.map(product => (
                                            <div key={product.id} className="product-card">
                                                <Link to={`/product/${product.id}`} className="product-link">
                                                    <div className="product-image">
                                                        <img
                                                            src={Array.isArray(product.imageUrls) && product.imageUrls.length > 0
                                                                ? product.imageUrls[0]
                                                                : product.imageUrl || '/placeholder-product.jpg'}
                                                            alt={product.name}
                                                        />
                                                    </div>
                                                    <div className="product-info">
                                                        <h3>{product.name}</h3>
                                                        <div className="product-price">{formatPrice(product.price)}</div>
                                                    </div>
                                                </Link>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'reviews' && (
                            <UserReviewSection userId={userId} userProfile={userProfile} />
                        )}

                        {activeTab === 'achievements' && (
                            <div className="achievements-section">
                                <h3>Achievements</h3>
                                <AchievementBadgeDisplay
                                    userId={userId}
                                    showTitle={false}
                                    limit={12}
                                />
                                <div className="view-all-achievements">
                                    <Link to={`/profile/${userId}/achievements`} className="view-all-link">
                                        View All Achievements
                                    </Link>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default UserProfilePage;