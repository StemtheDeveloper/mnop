import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import '../styles/PolicyPages.css';

const PolicyNotificationBanner = () => {
    const { currentUser, userProfile } = useUser();
    const [showNotification, setShowNotification] = useState(false);
    const [pendingPolicies, setPendingPolicies] = useState([]);
    const navigate = useNavigate();

    // Define current versions of all policies
    const CURRENT_VERSIONS = {
        terms: "1.0",
        privacy: "1.0",
        content: "1.0"
    };

    useEffect(() => {
        if (!currentUser || !userProfile) return;

        const pendingUpdates = [];

        // Check terms and conditions acceptance
        if (!userProfile.termsAccepted || userProfile.termsVersion !== CURRENT_VERSIONS.terms) {
            pendingUpdates.push({
                type: 'terms',
                name: 'Terms and Conditions',
                path: '/terms-and-conditions'
            });
        }

        // Check privacy policy acceptance
        if (!userProfile.privacyPolicyAccepted || userProfile.privacyPolicyVersion !== CURRENT_VERSIONS.privacy) {
            pendingUpdates.push({
                type: 'privacy',
                name: 'Privacy Policy',
                path: '/privacy-policy'
            });
        }

        // Check content policy acceptance
        if (!userProfile.contentPolicyAccepted || userProfile.contentPolicyVersion !== CURRENT_VERSIONS.content) {
            pendingUpdates.push({
                type: 'content',
                name: 'Content Policy',
                path: '/content-policy'
            });
        }

        setPendingPolicies(pendingUpdates);
        setShowNotification(pendingUpdates.length > 0);
    }, [currentUser, userProfile]);

    const acceptAllPolicies = async () => {
        if (!currentUser) return;

        try {
            const userRef = doc(db, 'users', currentUser.uid);
            const updates = {
                termsAccepted: true,
                termsVersion: CURRENT_VERSIONS.terms,
                termsAcceptedDate: new Date(),
                privacyPolicyAccepted: true,
                privacyPolicyVersion: CURRENT_VERSIONS.privacy,
                privacyPolicyAcceptedDate: new Date(),
                contentPolicyAccepted: true,
                contentPolicyVersion: CURRENT_VERSIONS.content,
                contentPolicyAcceptedDate: new Date()
            };
            
            await updateDoc(userRef, updates);
            setShowNotification(false);
        } catch (error) {
            console.error("Error updating policy acceptance:", error);
        }
    };

    const handleReviewClick = () => {
        // Navigate to the first pending policy
        if (pendingPolicies.length > 0) {
            navigate(pendingPolicies[0].path);
        }
    };

    if (!showNotification) return null;

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
                <button className="btn-accept-policy" onClick={acceptAllPolicies}>
                    Accept All
                </button>
                <button className="btn-review-policy" onClick={handleReviewClick}>
                    Review Updates
                </button>
            </div>
        </div>
    );
};

export default PolicyNotificationBanner;