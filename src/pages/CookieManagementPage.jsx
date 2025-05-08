import React, { useState, useEffect } from 'react';
import '../styles/CookieManagementPage.css';

const CookieManagementPage = () => {
    const [preferences, setPreferences] = useState({
        necessary: true, // Always enabled and cannot be disabled
        functional: false,
        analytics: false,
        advertising: false
    });

    const [saved, setSaved] = useState(false);

    useEffect(() => {
        // Load saved preferences if they exist
        const savedPreferences = localStorage.getItem('cookiePreferences');
        if (savedPreferences) {
            try {
                const parsed = JSON.parse(savedPreferences);
                setPreferences(prev => ({
                    ...prev,
                    ...parsed,
                    necessary: true // Always ensure necessary is true
                }));
            } catch (error) {
                console.error('Error parsing saved cookie preferences', error);
            }
        }
    }, []);

    const handleToggle = (category) => {
        // Prevent toggling necessary cookies
        if (category === 'necessary') return;

        setPreferences(prev => ({
            ...prev,
            [category]: !prev[category]
        }));

        // Reset saved state when preferences change
        setSaved(false);
    };

    const handleSavePreferences = () => {
        localStorage.setItem('cookieConsent', preferences.analytics || preferences.advertising ? 'all' : 'necessary');
        localStorage.setItem('cookiePreferences', JSON.stringify(preferences));
        setSaved(true);

        // Show saved message temporarily
        setTimeout(() => {
            setSaved(false);
        }, 3000);
    };

    return (
        <div className="cookie-management-page">
            <div className="cookie-management-container">
                <h1>Cookie Management</h1>

                <section className="cookie-policy-section">
                    <h2>Cookie Policy</h2>
                    <p>
                        We use cookies and similar technologies to improve your browsing experience, personalize content and ads,
                        analyze our traffic, and ensure the basic functionality of our website.
                    </p>
                    <p>
                        This page allows you to customize your cookie preferences for our website. Please note that disabling certain
                        cookies may affect the functionality of the website and your user experience.
                    </p>
                </section>

                <section className="cookie-preferences-section">
                    <h2>Manage Cookie Preferences</h2>

                    <div className="cookie-category">
                        <div className="cookie-category-header">
                            <div>
                                <h3>Necessary Cookies</h3>
                                <p>These cookies are essential for the website to function properly and cannot be disabled.</p>
                            </div>
                            <div className="toggle-switch enabled">
                                <input
                                    type="checkbox"
                                    id="necessary"
                                    checked={preferences.necessary}
                                    disabled={true}
                                />
                                <label htmlFor="necessary"></label>
                            </div>
                        </div>
                    </div>

                    <div className="cookie-category">
                        <div className="cookie-category-header">
                            <div>
                                <h3>Functional Cookies</h3>
                                <p>These cookies enable the website to provide enhanced functionality and personalization.</p>
                            </div>
                            <div className="toggle-switch">
                                <input
                                    type="checkbox"
                                    id="functional"
                                    checked={preferences.functional}
                                    onChange={() => handleToggle('functional')}
                                />
                                <label htmlFor="functional"></label>
                            </div>
                        </div>
                        <div className="cookie-details">
                            <p><strong>Purpose:</strong> Remember your preferences, language settings, and customizations.</p>
                            <p><strong>Duration:</strong> Up to 1 year</p>
                        </div>
                    </div>

                    <div className="cookie-category">
                        <div className="cookie-category-header">
                            <div>
                                <h3>Analytics Cookies</h3>
                                <p>These cookies help us understand how visitors interact with our website.</p>
                            </div>
                            <div className="toggle-switch">
                                <input
                                    type="checkbox"
                                    id="analytics"
                                    checked={preferences.analytics}
                                    onChange={() => handleToggle('analytics')}
                                />
                                <label htmlFor="analytics"></label>
                            </div>
                        </div>
                        <div className="cookie-details">
                            <p><strong>Purpose:</strong> Collect anonymized data on page visits, time spent, and user journeys.</p>
                            <p><strong>Duration:</strong> Up to 2 years</p>
                        </div>
                    </div>

                    <div className="cookie-category">
                        <div className="cookie-category-header">
                            <div>
                                <h3>Advertising Cookies</h3>
                                <p>These cookies are used to make advertising messages more relevant to you.</p>
                            </div>
                            <div className="toggle-switch">
                                <input
                                    type="checkbox"
                                    id="advertising"
                                    checked={preferences.advertising}
                                    onChange={() => handleToggle('advertising')}
                                />
                                <label htmlFor="advertising"></label>
                            </div>
                        </div>
                        <div className="cookie-details">
                            <p><strong>Purpose:</strong> Display personalized advertisements based on your interests and browsing habits.</p>
                            <p><strong>Duration:</strong> Up to 13 months</p>
                        </div>
                    </div>

                    <div className="save-preferences">
                        <button onClick={handleSavePreferences}>
                            Save Preferences
                        </button>
                        {saved && <span className="saved-message">Preferences saved successfully!</span>}
                    </div>
                </section>

                <section className="more-information">
                    <h2>More Information</h2>
                    <p>
                        For more information about how we use cookies and your personal data, please read our
                        <a href="/privacy-policy"> Privacy Policy</a>.
                    </p>
                    <p>
                        If you have any questions regarding our cookie policy, please contact us at
                        <a href="mailto:privacy@mnop.com"> privacy@mnop.com</a>.
                    </p>
                    <p>
                        Last updated: May 2025
                    </p>
                </section>
            </div>
        </div>
    );
};

export default CookieManagementPage;