import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { collection, query, where, getDocs, doc, getDoc, updateDoc, arrayRemove } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useToast } from '../context/ToastContext';
import '../styles/AchievementsPage.css';
import LoadingSpinner from '../components/LoadingSpinner';
import Button from '../components/Button';

const AchievementsPage = () => {
    const { userId } = useParams();
    const { currentUser } = useUser();
    const { showSuccess, showError } = useToast();
    const navigate = useNavigate();
    const [userProfile, setUserProfile] = useState(null);
    const [achievements, setAchievements] = useState([]);
    const [allAchievements, setAllAchievements] = useState([]);
    const [loading, setLoading] = useState(true);

    // Progress stats
    const [progressStats, setProgressStats] = useState({
        total: 0,
        earned: 0,
        tierCounts: {}, // { tier: { total: 0, earned: 0 } }
        categories: {} // { category: { total: 0, earned: 0 } }
    });

    // Bulk operations state
    const [selectedAchievements, setSelectedAchievements] = useState([]);
    const [selectAll, setSelectAll] = useState(false);
    const [bulkDeleteMode, setBulkDeleteMode] = useState(false);
    const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);

    // Check achievements state
    const [checkingAchievements, setCheckingAchievements] = useState(false);    // Get user achievements and profile with detailed progress info
    useEffect(() => {
        const fetchUserAndAchievements = async () => {
            try {
                setLoading(true);
                const targetUserId = userId || currentUser?.uid;

                if (!targetUserId) {
                    // Handle case where no user is logged in
                    navigate('/signin');
                    return;
                }

                // Get user profile
                const userRef = doc(db, 'users', targetUserId);
                const userDoc = await getDoc(userRef);

                if (!userDoc.exists()) {
                    setLoading(false);
                    return;
                }

                const userData = userDoc.data();
                setUserProfile(userData);

                const userAchievements = userData.achievements || [];

                // Get all possible achievements
                const achievementsRef = collection(db, 'achievements');
                const achievementsSnapshot = await getDocs(achievementsRef);

                // Fetch user metrics for progress tracking
                const [productCount, investmentCount, totalInvested, orderCount, reviewCount] = await Promise.all([
                    fetchProductCount(targetUserId),
                    fetchInvestmentCount(targetUserId),
                    fetchTotalInvested(targetUserId),
                    fetchOrderCount(targetUserId),
                    fetchReviewCount(targetUserId)
                ]);

                const allAchievementData = achievementsSnapshot.docs.map(doc => {
                    const achievementData = doc.data();
                    const id = doc.id;
                    const earned = userAchievements.includes(id);

                    // Add progress data based on achievement type
                    let progressData = null;

                    // Product achievements
                    if (id === 'first_product' || achievementData.category === 'product') {
                        if (id === 'first_product') {
                            progressData = {
                                current: Math.min(productCount, 1),
                                required: 1,
                                label: 'product uploaded'
                            };
                        } else if (id === 'product_collector_5') {
                            progressData = {
                                current: Math.min(productCount, 5),
                                required: 5,
                                label: 'products'
                            };
                        } else if (id === 'product_collector_10') {
                            progressData = {
                                current: Math.min(productCount, 10),
                                required: 10,
                                label: 'products'
                            };
                        } else if (id === 'product_collector_25') {
                            progressData = {
                                current: Math.min(productCount, 25),
                                required: 25,
                                label: 'products'
                            };
                        } else if (achievementData.triggerConfig?.type === 'product_upload' &&
                            achievementData.triggerConfig?.condition === 'count') {
                            const requiredCount = parseInt(achievementData.triggerConfig.value);
                            if (!isNaN(requiredCount)) {
                                progressData = {
                                    current: Math.min(productCount, requiredCount),
                                    required: requiredCount,
                                    label: 'products'
                                };
                            }
                        }
                    }

                    // Investment achievements
                    else if (achievementData.category === 'investment') {
                        if (achievementData.triggerConfig?.type === 'investment') {
                            if (achievementData.triggerConfig?.condition === 'count') {
                                const requiredCount = parseInt(achievementData.triggerConfig.value);
                                if (!isNaN(requiredCount)) {
                                    progressData = {
                                        current: Math.min(investmentCount, requiredCount),
                                        required: requiredCount,
                                        label: 'investments'
                                    };
                                }
                            } else if (achievementData.triggerConfig?.condition === 'amount') {
                                const requiredAmount = parseInt(achievementData.triggerConfig.value);
                                if (!isNaN(requiredAmount)) {
                                    progressData = {
                                        current: Math.min(totalInvested, requiredAmount),
                                        required: requiredAmount,
                                        label: 'invested',
                                        isCurrency: true
                                    };
                                }
                            }
                        }
                    }

                    // Order/Purchase achievements
                    else if (achievementData.category === 'purchase') {
                        if (achievementData.triggerConfig?.condition === 'count') {
                            const requiredCount = parseInt(achievementData.triggerConfig.value);
                            if (!isNaN(requiredCount)) {
                                progressData = {
                                    current: Math.min(orderCount, requiredCount),
                                    required: requiredCount,
                                    label: 'purchases'
                                };
                            }
                        }
                    }

                    // Review achievements
                    else if (achievementData.category === 'social' && achievementData.triggerConfig?.type === 'review') {
                        if (achievementData.triggerConfig?.condition === 'count') {
                            const requiredCount = parseInt(achievementData.triggerConfig.value);
                            if (!isNaN(requiredCount)) {
                                progressData = {
                                    current: Math.min(reviewCount, requiredCount),
                                    required: requiredCount,
                                    label: 'reviews'
                                };
                            }
                        }
                    }

                    return {
                        id,
                        ...achievementData,
                        earned,
                        progressData
                    };
                });

                // Sort achievements: earned first, then by tier
                allAchievementData.sort((a, b) => {
                    if (a.earned !== b.earned) return a.earned ? -1 : 1;
                    if (a.tier !== b.tier) return b.tier - a.tier;
                    return a.name.localeCompare(b.name);
                });

                setAllAchievements(allAchievementData);

                // Calculate progress statistics
                const stats = {
                    total: allAchievementData.length,
                    earned: allAchievementData.filter(a => a.earned).length,
                    tierCounts: {},
                    categories: {}
                };

                // Count by tier
                allAchievementData.forEach(achievement => {
                    const tier = achievement.tier || 1;
                    const category = achievement.category || 'Uncategorized';

                    // Initialize tier counts if not exists
                    if (!stats.tierCounts[tier]) {
                        stats.tierCounts[tier] = { total: 0, earned: 0 };
                    }

                    // Initialize category counts if not exists
                    if (!stats.categories[category]) {
                        stats.categories[category] = { total: 0, earned: 0 };
                    }

                    // Update tier counts
                    stats.tierCounts[tier].total++;
                    if (achievement.earned) stats.tierCounts[tier].earned++;

                    // Update category counts
                    stats.categories[category].total++;
                    if (achievement.earned) stats.categories[category].earned++;
                });

                setProgressStats(stats);

                // Filter to only earned achievements
                const earnedAchievements = allAchievementData.filter(a => a.earned);
                setAchievements(earnedAchievements);
            } catch (error) {
                console.error('Error fetching achievements:', error);
                showError('Failed to load achievements: ' + error.message);
            } finally {
                setLoading(false);
            }
        };

        // Helper functions to fetch user metrics for progress tracking
        const fetchProductCount = async (userId) => {
            try {
                const productsRef = collection(db, 'products');
                const q = query(productsRef, where('creatorId', '==', userId));
                const snapshot = await getDocs(q);
                return snapshot.docs.length;
            } catch (error) {
                console.error('Error fetching product count:', error);
                return 0;
            }
        };

        const fetchInvestmentCount = async (userId) => {
            try {
                const investmentsRef = collection(db, 'investments');
                const q = query(investmentsRef, where('investorId', '==', userId));
                const snapshot = await getDocs(q);
                return snapshot.docs.length;
            } catch (error) {
                console.error('Error fetching investment count:', error);
                return 0;
            }
        };

        const fetchTotalInvested = async (userId) => {
            try {
                const investmentsRef = collection(db, 'investments');
                const q = query(investmentsRef, where('investorId', '==', userId));
                const snapshot = await getDocs(q);
                let total = 0;
                snapshot.docs.forEach(doc => {
                    const investment = doc.data();
                    total += investment.amount || 0;
                });
                return total;
            } catch (error) {
                console.error('Error fetching total invested:', error);
                return 0;
            }
        };

        const fetchOrderCount = async (userId) => {
            try {
                const ordersRef = collection(db, 'orders');
                const q = query(ordersRef, where('userId', '==', userId));
                const snapshot = await getDocs(q);
                return snapshot.docs.length;
            } catch (error) {
                console.error('Error fetching order count:', error);
                return 0;
            }
        };

        const fetchReviewCount = async (userId) => {
            try {
                const reviewsRef = collection(db, 'reviews');
                const q = query(reviewsRef, where('userId', '==', userId));
                const snapshot = await getDocs(q);
                return snapshot.docs.length;
            } catch (error) {
                console.error('Error fetching review count:', error);
                return 0;
            }
        };

        fetchUserAndAchievements();
    }, [userId, currentUser, navigate, showError]);

    // Toggle achievement selection
    const toggleAchievementSelection = (achievementId) => {
        setSelectedAchievements(prev => {
            if (prev.includes(achievementId)) {
                return prev.filter(id => id !== achievementId);
            } else {
                return [...prev, achievementId];
            }
        });
    };

    // Toggle select all achievements
    const toggleSelectAll = () => {
        if (selectAll) {
            setSelectedAchievements([]);
        } else {
            setSelectedAchievements(achievements.map(a => a.id));
        }
        setSelectAll(!selectAll);
    };

    // Enter bulk delete mode
    const enterBulkDeleteMode = () => {
        setBulkDeleteMode(true);
    };

    // Cancel bulk operations
    const cancelBulkOperations = () => {
        setBulkDeleteMode(false);
        setConfirmBulkDelete(false);
        setSelectedAchievements([]);
        setSelectAll(false);
    };

    // Execute bulk delete
    const executeBulkDelete = async () => {
        if (!currentUser || selectedAchievements.length === 0) return;

        try {
            setLoading(true);
            const userRef = doc(db, 'users', currentUser.uid);

            // Remove each selected achievement from user's achievements array
            for (const achievementId of selectedAchievements) {
                await updateDoc(userRef, {
                    achievements: arrayRemove(achievementId)
                });
            }

            showSuccess(`Successfully removed ${selectedAchievements.length} achievements`);

            // Reset state and refresh achievements
            cancelBulkOperations();

            // Refresh the data
            const userDoc = await getDoc(userRef);
            if (userDoc.exists()) {
                const userData = userDoc.data();
                setUserProfile(userData);

                // Update the achievements list
                const updatedAchievements = achievements.filter(
                    achievement => !selectedAchievements.includes(achievement.id)
                );
                setAchievements(updatedAchievements);

                // Update allAchievements earned status
                const updatedAllAchievements = allAchievements.map(achievement => ({
                    ...achievement,
                    earned: userData.achievements?.includes(achievement.id) || false
                }));
                setAllAchievements(updatedAllAchievements);
            }
        } catch (error) {
            console.error('Error performing bulk delete:', error);
            showError('Failed to remove achievements: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    // Handle check for new achievements
    const handleCheckAchievements = async () => {
        if (!currentUser) return;

        setCheckingAchievements(true);
        try {
            // Import achievement service dynamically to avoid circular dependencies
            const achievementService = (await import('../services/achievementService')).default;

            // Check for different achievement types
            const productResults = await achievementService.checkProductAchievements(currentUser.uid);
            const investmentResults = await achievementService.checkInvestmentAchievements(currentUser.uid);
            const accountResults = await achievementService.checkAccountAgeAchievements(currentUser.uid);

            // Combine earned achievements
            const earnedIds = [
                ...productResults.earnedIds,
                ...investmentResults.earnedIds,
                ...accountResults.earnedIds
            ];

            if (earnedIds.length > 0) {
                showSuccess(`You earned ${earnedIds.length} new achievement${earnedIds.length !== 1 ? 's' : ''}!`);

                // Refresh the achievements data
                const userRef = doc(db, 'users', currentUser.uid);
                const userDoc = await getDoc(userRef);

                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    const userAchievements = userData.achievements || [];

                    // Update allAchievements with new earned status
                    const updatedAllAchievements = allAchievements.map(achievement => ({
                        ...achievement,
                        earned: userAchievements.includes(achievement.id)
                    }));

                    setAllAchievements(updatedAllAchievements);

                    // Update earned achievements list
                    const updatedEarnedAchievements = updatedAllAchievements.filter(
                        achievement => userAchievements.includes(achievement.id)
                    );

                    setAchievements(updatedEarnedAchievements);
                }
            } else {
                showSuccess('No new achievements earned. Keep working toward your goals!');
            }
        } catch (error) {
            console.error('Error checking for new achievements:', error);
            showError('Failed to check for new achievements: ' + error.message);
        } finally {
            setCheckingAchievements(false);
        }
    };

    // Get detailed progress description for an achievement
    const getDetailedProgressText = (achievement) => {
        if (!achievement.progressData) return null;

        const { current, required, label } = achievement.progressData;

        // Format based on achievement category
        switch (achievement.category) {
            case 'product':
                if (label === 'products') {
                    return `${current} product${current !== 1 ? 's' : ''} uploaded (${required} needed)`;
                }
                break;

            case 'investment':
                if (achievement.progressData.isCurrency) {
                    return `$${current.toLocaleString()} invested out of $${required.toLocaleString()}`;
                } else {
                    return `${current} investment${current !== 1 ? 's' : ''} made (${required} needed)`;
                }

            case 'purchase':
                return `${current} order${current !== 1 ? 's' : ''} placed (${required} needed)`;

            case 'social':
                if (achievement.triggerConfig?.type === 'review') {
                    return `${current} review${current !== 1 ? 's' : ''} submitted (${required} needed)`;
                }
                break;

            default:
                if (label) {
                    return `${current} ${label} (${required} needed)`;
                }
        }

        // Default format if no specific formatting applies
        return `${current}/${required} ${label || 'completed'}`;
    };

    if (loading) {
        return (
            <div className="achievements-page">
                <div className="loading-container">
                    <div className="loader"></div>
                    <p>Loading achievements...</p>
                </div>
            </div>
        );
    }

    if (!userProfile) {
        return (
            <div className="achievements-page">
                <div className="not-found-container">
                    <h1>User not found</h1>
                    <p>The requested user profile could not be found.</p>
                </div>
            </div>
        );
    }

    // Check if user is viewing their own profile
    const isOwnProfile = currentUser && (userId === currentUser.uid || !userId);

    return (
        <div className="achievements-page">
            <div className="achievements-header">
                <h1>
                    {userId && userId !== currentUser?.uid
                        ? `${userProfile.displayName || 'User'}'s Achievements`
                        : 'Your Achievements'}
                </h1>
                <p>
                    {progressStats.earned} of {progressStats.total} achievements earned ({Math.round((progressStats.earned / Math.max(1, progressStats.total)) * 100)}%)
                </p>
                {isOwnProfile && (
                    <Button
                        variant="primary"
                        className="check-achievements-button"
                        onClick={handleCheckAchievements}
                        disabled={loading || checkingAchievements}
                        isLoading={checkingAchievements}
                    >
                        Check for New Achievements
                    </Button>
                )}
            </div>

            <div className="achievements-progress-bar">
                <div
                    className="achievements-progress"
                    style={{ width: `${(progressStats.earned / Math.max(1, progressStats.total)) * 100}%` }}
                />
            </div>

            {/* Detailed progress breakdown */}
            <div className="achievements-stats-container">
                <h3 className="stats-heading">Achievement Progress</h3>

                <div className="stats-grid">
                    {/* Tier Progress */}
                    <div className="stats-card">
                        <h4>Tiers Progress</h4>
                        <div className="tier-progress">
                            {Object.entries(progressStats.tierCounts)
                                .sort(([tierA], [tierB]) => Number(tierA) - Number(tierB))
                                .map(([tier, { total, earned }]) => (
                                    <div key={tier} className="tier-bar-container">
                                        <div className="tier-label">Tier {tier}</div>
                                        <div className="tier-bar">
                                            <div
                                                className={`tier-bar-fill tier-${tier}`}
                                                style={{ width: `${(earned / Math.max(1, total)) * 100}%` }}
                                            />
                                        </div>
                                        <div className="tier-counts">
                                            {earned}/{total}
                                        </div>
                                    </div>
                                ))
                            }
                        </div>
                    </div>

                    {/* Category Progress */}
                    <div className="stats-card">
                        <h4>Categories Progress</h4>
                        <div className="category-progress">
                            {Object.entries(progressStats.categories)
                                .sort(([catA], [catB]) => catA.localeCompare(catB))
                                .map(([category, { total, earned }]) => (
                                    <div key={category} className="category-bar-container">
                                        <div className="category-label">{category}</div>
                                        <div className="category-bar">
                                            <div
                                                className="category-bar-fill"
                                                style={{ width: `${(earned / Math.max(1, total)) * 100}%` }}
                                            />
                                        </div>
                                        <div className="category-counts">
                                            {earned}/{total}
                                        </div>
                                    </div>
                                ))
                            }
                        </div>
                    </div>
                </div>
            </div>

            {/* Bulk operations controls - only show on own profile */}
            {isOwnProfile && achievements.length > 0 && (
                <div className="bulk-actions">
                    <div className="select-all-container">
                        <input
                            type="checkbox"
                            id="selectAll"
                            checked={selectAll}
                            onChange={toggleSelectAll}
                            disabled={loading || bulkDeleteMode}
                        />
                        <label htmlFor="selectAll">Select All</label>
                    </div>
                    <div className="bulk-action-buttons">
                        <Button
                            variant="danger"
                            className="bulk-delete-button"
                            onClick={enterBulkDeleteMode}
                            disabled={loading || selectedAchievements.length === 0 || bulkDeleteMode}
                        >
                            Remove Selected
                        </Button>
                    </div>
                    {selectedAchievements.length > 0 && (
                        <div className="selected-count">
                            {selectedAchievements.length} selected
                        </div>
                    )}
                </div>
            )}

            {/* Bulk delete confirmation */}
            {bulkDeleteMode && (
                <div className="bulk-delete-form">
                    <h3>Remove Selected Achievements</h3>
                    <p className="warning-message">
                        Are you sure you want to remove {selectedAchievements.length} achievements from your profile?
                        This action cannot be undone.
                    </p>
                    <div className="form-actions">
                        <Button
                            variant="light"
                            className="cancel-button"
                            onClick={cancelBulkOperations}
                            disabled={loading}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="danger"
                            className="delete-button"
                            onClick={() => setConfirmBulkDelete(true)}
                            disabled={loading}
                        >
                            Remove
                        </Button>
                    </div>
                </div>
            )}

            {/* Final confirmation */}
            {confirmBulkDelete && (
                <div className="bulk-delete-confirm">
                    <h3>Final Confirmation</h3>
                    <p className="warning-message">
                        Please confirm that you want to permanently remove these achievements.
                    </p>
                    <div className="form-actions">
                        <Button
                            variant="light"
                            className="cancel-button"
                            onClick={() => setConfirmBulkDelete(false)}
                            disabled={loading}
                        >
                            Go Back
                        </Button>
                        <Button
                            variant="danger"
                            className="delete-button"
                            onClick={executeBulkDelete}
                            disabled={loading}
                            isLoading={loading}
                        >
                            Confirm Removal
                        </Button>
                    </div>
                </div>
            )}

            <div className="achievements-grid">
                {/* Show all achievements - earned ones and locked/unearned ones */}
                {allAchievements.map(achievement => (
                    <div
                        key={achievement.id}
                        className={`achievement-card ${achievement.earned ? 'earned' : 'locked'} ${selectedAchievements.includes(achievement.id) ? 'selected' : ''}`}
                    >
                        {isOwnProfile && achievement.earned && (
                            <div className="achievement-selection">
                                <input
                                    type="checkbox"
                                    checked={selectedAchievements.includes(achievement.id)}
                                    onChange={() => toggleAchievementSelection(achievement.id)}
                                    disabled={loading || bulkDeleteMode}
                                />
                            </div>
                        )}
                        <div className={`achievement-icon tier-${achievement.tier || 1}`}>
                            {achievement.icon || '🏆'}
                        </div>
                        <div className="achievement-info">
                            <h3 className="achievement-name">{achievement.name}</h3>
                            <p className="achievement-description">{achievement.description}</p>
                            {achievement.earned ? (
                                <>
                                    <p className="achievement-rarity">
                                        Earned: {achievement.earnedDate
                                            ? new Date(achievement.earnedDate.seconds * 1000).toLocaleDateString()
                                            : 'Yes'}
                                    </p>
                                    {achievement.progressData && (
                                        <div className="achievement-progress-complete">
                                            <span className="achievement-complete-icon">✓</span>
                                            <span className="achievement-complete-text">
                                                Completed: {achievement.progressData.isCurrency
                                                    ? `$${achievement.progressData.required.toLocaleString()}`
                                                    : `${achievement.progressData.required} ${achievement.progressData.label}`}
                                            </span>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <>
                                    <p className="achievement-rarity">
                                        Tier {achievement.tier || 1} Achievement
                                    </p>
                                    {achievement.progressData && (
                                        <div className="achievement-progress-indicator">
                                            <div className="progress-bar-small">
                                                <div
                                                    className={`progress-fill tier-${achievement.tier || 1}`}
                                                    style={{
                                                        width: `${Math.min(100, (achievement.progressData.current / achievement.progressData.required) * 100)}%`
                                                    }}
                                                ></div>
                                            </div>
                                            <span className="progress-text">
                                                {getDetailedProgressText(achievement)}
                                            </span>
                                            <span className="progress-percentage">
                                                ({Math.floor((achievement.progressData.current / achievement.progressData.required) * 100)}%)
                                            </span>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default AchievementsPage;
