import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import PolicyService from '../services/policyService';
import '../styles/PolicyPages.css';

const TermsAndConditionsPage = () => {
    const { currentUser, userProfile } = useUser();
    const [hasAccepted, setHasAccepted] = useState(false);
    const [loading, setLoading] = useState(true);

    // Get the current version from the PolicyService
    const CURRENT_VERSION = PolicyService.CURRENT_VERSIONS.terms;
    const LAST_UPDATED = "April 30, 2025";

    useEffect(() => {
        // Check if the user has accepted the current version of the terms
        const checkAcceptanceStatus = async () => {
            if (!currentUser || !currentUser.uid) {
                setLoading(false);
                return;
            }

            try {
                const policyStatus = await PolicyService.checkPolicyAcceptance(currentUser.uid);
                setHasAccepted(policyStatus.terms);
            } catch (error) {
                console.error("Error checking terms acceptance:", error);
            } finally {
                setLoading(false);
            }
        };

        checkAcceptanceStatus();
    }, [currentUser, userProfile]);

    const handleAcceptTerms = async () => {
        if (!currentUser || !currentUser.uid) return;

        try {
            setLoading(true);
            await PolicyService.acceptPolicy(currentUser.uid, 'terms');
            setHasAccepted(true);
        } catch (error) {
            console.error("Error accepting terms:", error);
        } finally {
            setLoading(false);
        }
    };

    const scrollToSection = (sectionId) => {
        const section = document.getElementById(sectionId);
        if (section) {
            section.scrollIntoView({
                behavior: 'smooth'
            });
        }
    };

    return (
        <div className="policy-page">
            <div className="policy-header">
                <h1>Terms and Conditions</h1>
                <p>Please read these terms and conditions carefully before using our platform.</p>
            </div>

            <div className="policy-content">
                <div className="effective-date">
                    <p>Last Updated: {LAST_UPDATED}</p>
                    <p>Version: {CURRENT_VERSION}</p>
                </div>

                <div className="policy-toc">
                    <h3>Table of Contents</h3>
                    <ol className="toc-list">
                        <li><a onClick={() => scrollToSection('agreement')} href="#agreement">Agreement to Terms</a></li>
                        <li><a onClick={() => scrollToSection('license')} href="#license">Use License</a></li>
                        <li><a onClick={() => scrollToSection('accounts')} href="#accounts">User Accounts</a></li>
                        <li><a onClick={() => scrollToSection('designers')} href="#designers">Designers</a></li>
                        <li><a onClick={() => scrollToSection('manufacturers')} href="#manufacturers">Manufacturers</a></li>
                        <li><a onClick={() => scrollToSection('investors')} href="#investors">Investors</a></li>
                        <li><a onClick={() => scrollToSection('disclaimer')} href="#disclaimer">Disclaimer</a></li>
                        <li><a onClick={() => scrollToSection('limitations')} href="#limitations">Limitations</a></li>
                        <li><a onClick={() => scrollToSection('governing')} href="#governing">Governing Law</a></li>
                        <li><a onClick={() => scrollToSection('changes')} href="#changes">Changes to Terms</a></li>
                    </ol>
                </div>

                <section id="agreement">
                    <h2>1. Agreement to Terms</h2>
                    <p>By accessing or using the M'NOP platform, you agree to be bound by these Terms and Conditions and all applicable laws and regulations. If you do not agree with any of these terms, you are prohibited from using or accessing this site.</p>
                </section>

                <section id="license">
                    <h2>2. Use License</h2>
                    <p>Permission is granted to temporarily access the materials on M'NOP's platform for personal, non-commercial transitory viewing only. This is the grant of a license, not a transfer of title, and under this license you may not:</p>
                    <ul>
                        <li>Modify or copy the materials;</li>
                        <li>Use the materials for any commercial purpose or for any public display;</li>
                        <li>Attempt to reverse engineer any software contained on M'NOP's platform;</li>
                        <li>Remove any copyright or other proprietary notations from the materials; or</li>
                        <li>Transfer the materials to another person or "mirror" the materials on any other server.</li>
                    </ul>
                </section>

                <section id="accounts">
                    <h2>3. User Accounts</h2>
                    <p>When you create an account with us, you guarantee that the information you provide is accurate, complete, and current at all times. Inaccurate, incomplete, or obsolete information may result in the immediate termination of your account on the platform.</p>
                    <p>You are responsible for maintaining the confidentiality of your account and password, including but not limited to the restriction of access to your computer and/or account. You agree to accept responsibility for any and all activities or actions that occur under your account and/or password.</p>
                </section>

                <section id="designers">
                    <h2>4. Designers</h2>
                    <p>Designers on the M'NOP platform maintain ownership of their intellectual property, but grant M'NOP a non-exclusive license to display, promote, and facilitate sales of their designs on the platform.</p>
                    <p>Designers are responsible for ensuring that their designs do not infringe upon the intellectual property rights of others and comply with all relevant laws and regulations.</p>
                </section>

                <section id="manufacturers">
                    <h2>5. Manufacturers</h2>
                    <p>Manufacturers agree to provide accurate information about their capabilities, pricing, and production timelines. Manufacturers are responsible for complying with all laws and regulations related to the manufacturing of products.</p>
                </section>

                <section id="investors">
                    <h2>6. Investors</h2>
                    <p>Investors acknowledge that investments made through the platform carry inherent risks, and M'NOP does not guarantee returns on any investment. Investors are responsible for conducting their own due diligence before making investment decisions.</p>
                </section>

                <section id="disclaimer">
                    <h2>7. Disclaimer</h2>
                    <p>The materials on M'NOP's platform are provided on an 'as is' basis. M'NOP makes no warranties, expressed or implied, and hereby disclaims and negates all other warranties including, without limitation, implied warranties or conditions of merchantability, fitness for a particular purpose, or non-infringement of intellectual property or other violation of rights.</p>
                </section>

                <section id="limitations">
                    <h2>8. Limitations</h2>
                    <p>In no event shall M'NOP or its suppliers be liable for any damages (including, without limitation, damages for loss of data or profit, or due to business interruption) arising out of the use or inability to use the materials on M'NOP's platform, even if M'NOP or a M'NOP authorized representative has been notified orally or in writing of the possibility of such damage.</p>
                </section>

                <section id="governing">
                    <h2>9. Governing Law</h2>
                    <p>These Terms shall be governed and construed in accordance with the laws of the United States, without regard to its conflict of law provisions.</p>
                </section>

                <section id="changes">
                    <h2>10. Changes to Terms</h2>
                    <p>M'NOP reserves the right, at its sole discretion, to modify or replace these Terms at any time. By continuing to access or use our platform after any revisions become effective, you agree to be bound by the revised terms. If you do not agree to the new terms, you are no longer authorized to use the platform.</p>
                </section>

                <div className="policy-navigation">
                    <Link to="/privacy-policy">Privacy Policy</Link>
                    <Link to="/content-policy">Content Policy</Link>
                    <Link to="/">Return to Home</Link>
                </div>

                {currentUser && !loading && !hasAccepted && (
                    <div className="policy-update-notification">
                        <div className="policy-update-notification-content">
                            <h3>Terms and Conditions Update</h3>
                            <p>We've updated our Terms and Conditions. Please review and accept the new terms to continue using our platform.</p>
                        </div>
                        <div className="policy-update-actions">
                            <button className="btn-accept-policy" onClick={handleAcceptTerms}>Accept Terms</button>
                        </div>
                    </div>
                )}

                {currentUser && !loading && hasAccepted && (
                    <div className="policy-accepted-notice">
                        <p>You have accepted the current version of our Terms and Conditions.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TermsAndConditionsPage;