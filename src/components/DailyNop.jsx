import React, { useState, useEffect } from 'react';
import { useUser } from '../context/UserContext';
import { getDailyNop, collectNop, hasCollectedToday } from '../services/nopService';
import LoadingSpinner from './LoadingSpinner';

const DailyNop = () => {
    const [dailyNop, setDailyNop] = useState(null);
    const [loading, setLoading] = useState(true);
    const [collecting, setCollecting] = useState(false);
    const [collected, setCollected] = useState(false);
    const [error, setError] = useState('');
    const [collectSuccess, setCollectSuccess] = useState(false);
    const [imageError, setImageError] = useState(false);

    // Get the authentication data from UserContext
    const userContext = useUser();
    const { currentUser } = userContext;

    // Determine if user is logged in based on currentUser
    const isLoggedIn = !!currentUser;

    // Debug authentication state
    useEffect(() => {
        console.log("DailyNop Authentication State:", {
            currentUser: currentUser ? {
                uid: currentUser.uid,
                email: currentUser.email
            } : null,
            isLoggedIn,
            userContextKeys: Object.keys(userContext)
        });
    }, [currentUser, isLoggedIn, userContext]);

    // Fetch the daily Nop when component mounts
    useEffect(() => {
        const fetchDailyNop = async () => {
            try {
                setLoading(true);
                const nop = await getDailyNop();
                console.log("Retrieved Nop:", nop); // Log the Nop data to see what we're getting
                setDailyNop(nop);
                setImageError(false); // Reset image error state on new Nop

                // Check if the user has already collected this Nop today
                if (isLoggedIn && currentUser) {
                    console.log("Checking if user has collected today's Nop:", currentUser.uid);
                    const hasCollected = await hasCollectedToday(currentUser.uid);
                    setCollected(hasCollected);
                    console.log("Has user collected today?", hasCollected);
                } else {
                    console.log("User not authenticated, skipping collection check");
                }
            } catch (err) {
                console.error('Error fetching daily Nop:', err);
                setError('Could not load today\'s collectible');
            } finally {
                setLoading(false);
            }
        };

        fetchDailyNop();
    }, [isLoggedIn, currentUser]);

    // Handle image loading error
    const handleImageError = () => {
        console.error('Failed to load Nop image:', dailyNop?.imageURL);
        setImageError(true);
    };

    const handleCollect = async () => {
        if (!isLoggedIn || !currentUser) {
            setError('Please log in to collect Nops');
            return;
        }

        setCollecting(true);
        setError('');

        try {
            const result = await collectNop(currentUser.uid, dailyNop.id);

            if (result.success) {
                setCollected(true);
                setCollectSuccess(true);
                setTimeout(() => setCollectSuccess(false), 3000); // Reset success message after 3 seconds
            } else {
                setError(result.message);
            }
        } catch (err) {
            console.error('Error collecting Nop:', err);
            setError('Failed to collect Nop');
        } finally {
            setCollecting(false);
        }
    };

    if (loading) {
        return (
            <div className="nop-card loading">
                <LoadingSpinner />
                <p>Loading today's collectible...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="nop-card error">
                <p>{error}</p>
            </div>
        );
    }

    if (!dailyNop) {
        return (
            <div className="nop-card error">
                <p>No collectible available today</p>
            </div>
        );
    }

    return (
        <div className="nop-card">
            <div className="nop-character">
                {imageError || (!dailyNop.imageURL && !dailyNop.imageUrl && !dailyNop.image) ? (
                    <div className="nop-placeholder">
                        {dailyNop.name?.charAt(0) || '?'}
                    </div>
                ) : (
                    <img
                        src={dailyNop.imageURL || dailyNop.imageUrl || dailyNop.image}
                        alt={dailyNop.name}
                        className="coin-purson"
                        onError={handleImageError}
                    />
                )}
                <span className="nop-label">{dailyNop.name}</span>
            </div>

            {collectSuccess && (
                <div className="collect-success">
                    Success! Added to your collection!
                </div>
            )}

            <button
                className={`collect-btn ${collected ? 'collected' : ''}`}
                onClick={handleCollect}
                disabled={collecting || collected || !isLoggedIn}
            >
                {collecting ? 'Collecting...' : collected ? 'Collected!' : 'Collect'}
            </button>

            {!isLoggedIn && (
                <p className="login-prompt">Log in to collect Nops!</p>
            )}
        </div>
    );
};

export default DailyNop;