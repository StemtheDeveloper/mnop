import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { collection, query, where, getDocs, doc, getDoc, updateDoc, arrayRemove } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useToast } from '../context/ToastContext';
import '../styles/AchievementsPage.css';
import LoadingSpinner from '../components/LoadingSpinner';

const AchievementsPage = () => {
    const { userId } = useParams();
    const { currentUser } = useUser();
    const { showSuccess, showError } = useToast();
    const navigate = useNavigate();
    const [userProfile, setUserProfile] = useState(null);
    const [achievements, setAchievements] = useState([]);
    const [allAchievements, setAllAchievements] = useState([]);
    const [loading, setLoading] = useState(true);

    // Bulk operations state
    const [selectedAchievements, setSelectedAchievements] = useState([]);
    const [selectAll, setSelectAll] = useState(false);
    const [bulkDeleteMode, setBulkDeleteMode] = useState(false);
    const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);

    // Check achievements state
    const [checkingAchievements, setCheckingAchievements] = useState(false);

    // Get user achievements and profile
    useEffect(() => {
        const fetchUserAndAchievements = async () => {
            try {
                setLoading(true);
                const targetUserId = userId || currentUser?.uid;

                if (!targetUserId) {
                    setLoading(false);
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

                const allAchievementData = achievementsSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    earned: userAchievements.includes(doc.id)
                }));

                // Sort achievements: earned first, then by tier
                allAchievementData.sort((a, b) => {
                    if (a.earned !== b.earned) {
                        return a.earned ? -1 : 1;
                    }

                    return (b.tier || 1) - (a.tier || 1);
                });

                setAllAchievements(allAchievementData);

                // Filter to only earned achievements
                const earnedAchievements = allAchievementData.filter(
                    achievement => userAchievements.includes(achievement.id)
                );

                setAchievements(earnedAchievements);
            } catch (error) {
                console.error('Error fetching achievements:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchUserAndAchievements();
    }, [userId, currentUser]);

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
                    {achievements.length} of {allAchievements.length} achievements earned
                </p>
                {isOwnProfile && (
                    <button className="check-achievements-button" onClick={handleCheckAchievements} disabled={loading || checkingAchievements}>
                        {checkingAchievements ? <LoadingSpinner /> : "Check for New Achievements"}
                    </button>
                )}
            </div>

            <div className="achievements-progress-bar">
                <div
                    className="achievements-progress"
                    style={{ width: `${(achievements.length / Math.max(1, allAchievements.length)) * 100}%` }}
                />
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
                        <button
                            className="bulk-delete-button"
                            onClick={enterBulkDeleteMode}
                            disabled={loading || selectedAchievements.length === 0 || bulkDeleteMode}
                        >
                            Remove Selected
                        </button>
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
                        <button
                            className="cancel-button"
                            onClick={cancelBulkOperations}
                            disabled={loading}
                        >
                            Cancel
                        </button>
                        <button
                            className="delete-button"
                            onClick={() => setConfirmBulkDelete(true)}
                            disabled={loading}
                        >
                            Remove
                        </button>
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
                        <button
                            className="cancel-button"
                            onClick={() => setConfirmBulkDelete(false)}
                            disabled={loading}
                        >
                            Go Back
                        </button>
                        <button
                            className="delete-button"
                            onClick={executeBulkDelete}
                            disabled={loading}
                        >
                            {loading ? <LoadingSpinner /> : 'Confirm Removal'}
                        </button>
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
                            <p className="achievement-rarity">
                                {achievement.earned
                                    ? `Earned: ${achievement.earnedDate ? new Date(achievement.earnedDate.seconds * 1000).toLocaleDateString() : 'Yes'}`
                                    : `Tier ${achievement.tier || 1} Achievement`}
                            </p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default AchievementsPage;
