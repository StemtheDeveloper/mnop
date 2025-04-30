import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import PolicyService from '../services/policyService';
import '../styles/PolicyPages.css';

const PrivacyPolicyPage = () => {
    const { currentUser, userProfile } = useUser();
    const [hasAccepted, setHasAccepted] = useState(false);
    const [loading, setLoading] = useState(true);

    // Get the current version from the PolicyService
    const CURRENT_VERSION = PolicyService.CURRENT_VERSIONS.privacy;
    const LAST_UPDATED = "April 30, 2025";

    useEffect(() => {
        // Check if the user has accepted the current version of the privacy policy
        const checkAcceptanceStatus = async () => {
            if (!currentUser || !currentUser.uid) {
                setLoading(false);
                return;
            }

            try {
                const policyStatus = await PolicyService.checkPolicyAcceptance(currentUser.uid);
                setHasAccepted(policyStatus.privacy);
            } catch (error) {
                console.error("Error checking privacy policy acceptance:", error);
            } finally {
                setLoading(false);
            }
        };

        checkAcceptanceStatus();
    }, [currentUser, userProfile]);

    const handleAcceptPrivacyPolicy = async () => {
        if (!currentUser || !currentUser.uid) return;

        try {
            setLoading(true);
            await PolicyService.acceptPolicy(currentUser.uid, 'privacy');
            setHasAccepted(true);
        } catch (error) {
            console.error("Error accepting privacy policy:", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="policy-page">
            <div className="policy-header">
                <h1>Privacy Policy</h1>
                <p>At M'NOP, we take your privacy seriously. This Privacy Policy explains how we collect, use, and protect your personal information.</p>
            </div>

            <div className="policy-content">
                <div className="effective-date">
                    <p>Last Updated: {LAST_UPDATED}</p>
                    <p>Version: {CURRENT_VERSION}</p>
                </div>

                <h2>1. Information We Collect</h2>
                <h3>1.1 Personal Information</h3>
                <p>We may collect the following types of personal information:</p>
                <ul>
                    <li><strong>Account Information:</strong> When you create an account, we collect your name, email address, username, and password.</li>
                    <li><strong>Profile Information:</strong> Information you provide in your user profile such as profile picture, bio, location, and website.</li>
                    <li><strong>Financial Information:</strong> For designers, manufacturers, and investors, we collect necessary financial information for payments and investments, including payment methods and bank account details.</li>
                    <li><strong>Communication Data:</strong> Messages, comments, and other communications you send through our platform.</li>
                </ul>

                <h3>1.2 Usage Information</h3>
                <p>We automatically collect information about how you interact with our platform, including:</p>
                <ul>
                    <li>Device information (browser type, IP address, device type)</li>
                    <li>Log data (pages visited, actions taken, timestamps)</li>
                    <li>Location information (approximate location based on IP address)</li>
                    <li>Cookies and similar technologies</li>
                </ul>

                <h2>2. How We Use Your Information</h2>
                <p>We use the information we collect for the following purposes:</p>
                <ul>
                    <li>Provide, maintain, and improve our platform</li>
                    <li>Process transactions and manage user accounts</li>
                    <li>Communicate with you, including sending notifications, updates, and support messages</li>
                    <li>Personalize your experience and deliver relevant content</li>
                    <li>Monitor and analyze trends, usage, and activities</li>
                    <li>Protect against, identify, and prevent fraud and other illegal activities</li>
                </ul>

                <h2>3. Information Sharing and Disclosure</h2>
                <p>We may share your information with:</p>
                <ul>
                    <li><strong>Service Providers:</strong> Third-party vendors who help us operate our platform (e.g., payment processors, hosting providers)</li>
                    <li><strong>Platform Users:</strong> Information shared with other users as part of the normal operation of the platform (e.g., designers, manufacturers, investors)</li>
                    <li><strong>Legal Requirements:</strong> When required by law or to protect our rights and safety</li>
                </ul>
                <p>We will not sell your personal information to third parties.</p>

                <h2>4. Data Security</h2>
                <p>We implement appropriate security measures to protect your personal information from unauthorized access, alteration, disclosure, or destruction. However, no method of transmission over the Internet or electronic storage is 100% secure, and we cannot guarantee absolute security.</p>

                <h2>5. Your Rights and Choices</h2>
                <p>Depending on your location, you may have certain rights regarding your personal information, including:</p>
                <ul>
                    <li>Access to your personal information</li>
                    <li>Correction of inaccurate information</li>
                    <li>Deletion of your information</li>
                    <li>Restriction of processing</li>
                    <li>Data portability</li>
                    <li>Objection to processing</li>
                </ul>
                <p>To exercise these rights, please contact us at privacy@mnop.com.</p>

                <h2>6. Children's Privacy</h2>
                <p>Our platform is not intended for children under 13 years of age. We do not knowingly collect personal information from children under 13. If you are a parent or guardian and believe we may have collected information about a child, please contact us.</p>

                <h2>7. Changes to This Privacy Policy</h2>
                <p>We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last Updated" date. You are advised to review this Privacy Policy periodically for any changes.</p>

                <h2>8. Contact Us</h2>
                <p>If you have any questions about this Privacy Policy, please contact us at:</p>
                <p>Email: privacy@mnop.com</p>
                <p>Address: 123 M'NOP Street, San Francisco, CA 94103</p>

                <div className="policy-navigation">
                    <Link to="/terms-and-conditions">Terms and Conditions</Link>
                    <Link to="/content-policy">Content Policy</Link>
                    <Link to="/">Return to Home</Link>
                </div>

                {currentUser && !loading && !hasAccepted && (
                    <div className="policy-update-notification">
                        <div className="policy-update-notification-content">
                            <h3>Privacy Policy Update</h3>
                            <p>We've updated our Privacy Policy. Please review and accept the new policy to continue using our platform.</p>
                        </div>
                        <div className="policy-update-actions">
                            <button className="btn-accept-policy" onClick={handleAcceptPrivacyPolicy}>Accept Policy</button>
                        </div>
                    </div>
                )}

                {currentUser && !loading && hasAccepted && (
                    <div className="policy-accepted-notice">
                        <p>You have accepted the current version of our Privacy Policy.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PrivacyPolicyPage;