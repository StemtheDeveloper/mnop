import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import PolicyService from '../services/policyService';
import '../styles/PolicyPages.css';

const PolicyNotificationBanner = () => {
    const { currentUser, userProfile } = useUser();
    const [showNotification, setShowNotification] = useState(false);
    const [pendingPolicies, setPendingPolicies] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        const checkPolicies = async () => {
            if (!currentUser || !currentUser.uid) return;

            try {
                setLoading(true);
                const policies = await PolicyService.getPendingPolicies(currentUser.uid);
                setPendingPolicies(policies);
                setShowNotification(policies.length > 0);
            } catch (error) {
                console.error("Error checking policy status:", error);
            } finally {
                setLoading(false);
            }
        };

        checkPolicies();
    }, [currentUser, userProfile]);

    const handleAcceptAll = async () => {
        if (!currentUser) return;

        try {
            setLoading(true);
            await PolicyService.acceptAllPolicies(currentUser.uid);
            setShowNotification(false);
            setPendingPolicies([]);
        } catch (error) {
            console.error("Error accepting policies:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleReviewClick = () => {
        // Navigate to the first pending policy
        if (pendingPolicies.length > 0) {
            navigate(pendingPolicies[0].path);
        }
    };

    if (loading || !showNotification || pendingPolicies.length === 0) return null;

    return (
        <div className="policy-update-notification">
            <div className="policy-update-notification-content">
                <h3>Policy Updates</h3>
                <p>
                    We've updated our {pendingPolicies.map(p => p.name).join(', ')}.
                    Please review and accept these updates to continue using our platform.
                </p>
            </div>
            <div className="policy-update-actions">
                <button
                    className="btn-accept-policy"
                    onClick={handleAcceptAll}
                    disabled={loading}
                >
                    Accept All
                </button>
                <button
                    className="btn-review-policy"
                    onClick={handleReviewClick}
                    disabled={loading}
                >
                    Review Updates
                </button>
            </div>
        </div>
    );
};

export default PolicyNotificationBanner;