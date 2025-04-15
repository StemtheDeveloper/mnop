import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import '../styles/AchievementsPage.css';

const AchievementsPage = () => {
    const { userId } = useParams();
    const { currentUser } = useUser();
    const [userProfile, setUserProfile] = useState(null);
    const [achievements, setAchievements] = useState([]);
    const [allAchievements, setAllAchievements] = useState([]);
    const [loading, setLoading] = useState(true);

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
            </div>

            <div className="achievements-progress-bar">
                <div
                    className="achievements-progress"
                    style={{ width: `${(achievements.length / Math.max(1, allAchievements.length)) * 100}%` }}
                />
            </div>

            <div className="achievements-grid">
                {/* Show all achievements - earned ones and locked/unearned ones */}
                {allAchievements.map(achievement => (
                    <div
                        key={achievement.id}
                        className={`achievement-card ${achievement.earned ? 'earned' : 'locked'}`}
                    >
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
