import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './CookieConsentBanner.css';

const CookieConsentBanner = () => {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        // Check if user has already consented
        const cookieConsent = localStorage.getItem('cookieConsent');
        if (!cookieConsent) {
            // Show banner after a short delay for better UX
            const timer = setTimeout(() => {
                setVisible(true);
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, []);

    const handleAcceptAll = () => {
        // Save all cookie preferences
        localStorage.setItem('cookieConsent', 'all');
        localStorage.setItem('cookiePreferences', JSON.stringify({
            necessary: true,
            functional: true,
            analytics: true,
            advertising: true
        }));
        setVisible(false);
    };

    const handleAcceptNecessary = () => {
        // Save only necessary cookies preference
        localStorage.setItem('cookieConsent', 'necessary');
        localStorage.setItem('cookiePreferences', JSON.stringify({
            necessary: true,
            functional: false,
            analytics: false,
            advertising: false
        }));
        setVisible(false);
    };

    const handleManagePreferences = () => {
        // Navigate to cookie preferences page
        window.location.href = '/cookies';
        setVisible(false);
    };

    if (!visible) return null;

    return (
        <div className="cookie-consent-banner">
            <div className="cookie-consent-content">
                <h3>Cookie Notice</h3>
                <p>
                    We use cookies to enhance your browsing experience, serve personalized ads or content,
                    and analyze our traffic. By clicking "Accept All", you consent to our use of cookies.
                    Read our <Link to="/cookies">Cookie Policy</Link> for more information.
                </p>
                <div className="cookie-buttons">
                    <button className="btn-manage" onClick={handleManagePreferences}>
                        Manage Preferences
                    </button>
                    <button className="btn-necessary" onClick={handleAcceptNecessary}>
                        Accept Necessary
                    </button>
                    <button className="btn-accept-all" onClick={handleAcceptAll}>
                        Accept All
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CookieConsentBanner;