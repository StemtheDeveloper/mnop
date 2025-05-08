import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import PolicyService from '../services/policyService';
import '../styles/PolicyPages.css';

const ContentPolicyPage = () => {
    const { currentUser, userProfile } = useUser();
    const [hasAccepted, setHasAccepted] = useState(false);
    const [loading, setLoading] = useState(true);

    // Get the current version from the PolicyService
    const CURRENT_VERSION = PolicyService.CURRENT_VERSIONS.content;
    const LAST_UPDATED = "April 30, 2025";

    useEffect(() => {
        // Check if the user has accepted the current version of the content policy
        const checkAcceptanceStatus = async () => {
            if (!currentUser || !currentUser.uid) {
                setLoading(false);
                return;
            }

            try {
                const policyStatus = await PolicyService.checkPolicyAcceptance(currentUser.uid);
                setHasAccepted(policyStatus.content);
            } catch (error) {
                console.error("Error checking content policy acceptance:", error);
            } finally {
                setLoading(false);
            }
        };

        checkAcceptanceStatus();
    }, [currentUser, userProfile]);

    const handleAcceptContentPolicy = async () => {
        if (!currentUser || !currentUser.uid) return;

        try {
            setLoading(true);
            await PolicyService.acceptPolicy(currentUser.uid, 'content');
            setHasAccepted(true);
        } catch (error) {
            console.error("Error accepting content policy:", error);
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
                <h1>Content Policy</h1>
                <p>Our platform thrives when everyone contributes quality content. This policy outlines what types of content are acceptable and what may be removed.</p>
            </div>

            <div className="policy-content">
                <div className="effective-date">
                    <p>Last Updated: {LAST_UPDATED}</p>
                    <p>Version: {CURRENT_VERSION}</p>
                </div>

                <div className="policy-toc">
                    <h3>Table of Contents</h3>
                    <ol className="toc-list">
                        <li><a onClick={() => scrollToSection('philosophy')} href="#philosophy">Our Content Philosophy</a></li>
                        <li><a onClick={() => scrollToSection('prohibited')} href="#prohibited">Prohibited Content</a></li>
                        <li><a onClick={() => scrollToSection('guidelines')} href="#guidelines">Product and Design Guidelines</a></li>
                        <li><a onClick={() => scrollToSection('communication')} href="#communication">Communication Guidelines</a></li>
                        <li><a onClick={() => scrollToSection('enforcement')} href="#enforcement">Enforcement</a></li>
                        <li><a onClick={() => scrollToSection('reporting')} href="#reporting">Reporting Content Violations</a></li>
                        <li><a onClick={() => scrollToSection('changes')} href="#changes">Changes to This Policy</a></li>
                    </ol>
                </div>

                <section id="philosophy">
                    <h2>1. Our Content Philosophy</h2>
                    <p>M'NOP is a platform designed to connect designers, manufacturers, investors, and customers. We aim to foster an environment of creativity, innovation, and respectful collaboration. This Content Policy is designed to ensure that the content shared on our platform supports these goals.</p>
                </section>

                <section id="prohibited">
                    <h2>2. Prohibited Content</h2>
                    <p>The following types of content are prohibited on the M'NOP platform:</p>

                    <h3>2.1 Illegal Content</h3>
                    <ul>
                        <li>Content that violates any applicable law or regulation</li>
                        <li>Content that infringes on intellectual property rights, including copyright and trademarks</li>
                        <li>Content related to illegal goods or services</li>
                    </ul>

                    <h3>2.2 Harmful or Dangerous Content</h3>
                    <ul>
                        <li>Designs for weapons, explosives, or other items primarily designed to cause harm</li>
                        <li>Content promoting self-harm or harm to others</li>
                        <li>Instructions for dangerous activities without proper safety precautions</li>
                    </ul>

                    <h3>2.3 Hateful Content</h3>
                    <ul>
                        <li>Content that promotes hate or violence against individuals or groups based on attributes such as race, ethnicity, religion, disability, gender, age, veteran status, sexual orientation, or gender identity</li>
                        <li>Content containing slurs or stereotypes that promote discrimination</li>
                    </ul>

                    <h3>2.4 Harassment and Bullying</h3>
                    <ul>
                        <li>Content that harasses, intimidates, or bullies individuals or groups</li>
                        <li>Threats or incitement of violence</li>
                        <li>Disclosure of private information without consent (doxxing)</li>
                    </ul>

                    <h3>2.5 Adult Content</h3>
                    <ul>
                        <li>Sexually explicit or pornographic content</li>
                        <li>Content that sexualizes minors</li>
                    </ul>

                    <h3>2.6 Misleading Content</h3>
                    <ul>
                        <li>Deceptive product descriptions or images</li>
                        <li>False claims about product capabilities or specifications</li>
                        <li>Artificially inflated reviews or engagement</li>
                    </ul>
                </section>

                <section id="guidelines">
                    <h2>3. Product and Design Guidelines</h2>
                    <p>Products and designs submitted to the M'NOP platform must adhere to the following guidelines:</p>
                    <ul>
                        <li>Products must be accurately described with clear images and specifications</li>
                        <li>All product claims must be verifiable</li>
                        <li>Health and safety claims must be backed by legitimate scientific evidence</li>
                        <li>Products must comply with applicable safety standards and regulations</li>
                        <li>Designs must not infringe on the intellectual property rights of others</li>
                    </ul>
                </section>

                <section id="communication">
                    <h2>4. Communication Guidelines</h2>
                    <p>All communication on the platform (including messages, comments, reviews, etc.) must be:</p>
                    <ul>
                        <li>Respectful and constructive</li>
                        <li>Relevant to the topic or product</li>
                        <li>Free from excessive profanity or offensive language</li>
                        <li>Free from spam, scams, or commercial solicitation outside platform parameters</li>
                    </ul>
                </section>

                <section id="enforcement">
                    <h2>5. Enforcement</h2>
                    <p>M'NOP reserves the right to:</p>
                    <ul>
                        <li>Remove content that violates this policy</li>
                        <li>Temporarily or permanently suspend accounts that repeatedly violate this policy</li>
                        <li>Reject product submissions that don't meet our guidelines</li>
                        <li>Report illegal content to relevant authorities</li>
                    </ul>
                </section>

                <section id="reporting">
                    <h2>6. Reporting Content Violations</h2>
                    <p>If you encounter content that violates our Content Policy, please report it using the reporting features within the platform or by contacting us at content@mnop.com. We take all reports seriously and will review reported content promptly.</p>
                </section>

                <section id="changes">
                    <h2>7. Changes to This Policy</h2>
                    <p>We may update our Content Policy from time to time. We will notify users of any significant changes by posting the new policy on this page and updating the "Last Updated" date. Your continued use of the platform after any changes constitutes acceptance of the updated policy.</p>
                </section>

                <div className="policy-navigation">
                    <Link to="/terms-and-conditions">Terms and Conditions</Link>
                    <Link to="/privacy-policy">Privacy Policy</Link>
                    <Link to="/">Return to Home</Link>
                </div>

                {currentUser && !loading && !hasAccepted && (
                    <div className="policy-update-notification">
                        <div className="policy-update-notification-content">
                            <h3>Content Policy Update</h3>
                            <p>We've updated our Content Policy. Please review and accept the new policy to continue using our platform.</p>
                        </div>
                        <div className="policy-update-actions">
                            <button className="btn-accept-policy" onClick={handleAcceptContentPolicy}>Accept Policy</button>
                        </div>
                    </div>
                )}

                {currentUser && !loading && hasAccepted && (
                    <div className="policy-accepted-notice">
                        <p>You have accepted the current version of our Content Policy.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ContentPolicyPage;