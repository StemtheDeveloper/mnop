import React, { useState } from 'react';
import './SocialShareButtons.css';

const SocialShareButtons = ({
    url = window.location.href,
    title = 'Check out this page',
    description = '',
    mediaUrl = '',
    hashtags = '',
    showText = true,
    layout = 'horizontal',
    platforms = ['facebook', 'twitter', 'pinterest', 'linkedin', 'whatsapp', 'email', 'copy']
}) => {
    const [copied, setCopied] = useState(false);
    const [showTooltip, setShowTooltip] = useState(null);

    // Encode for URLs
    const encodedUrl = encodeURIComponent(url);
    const encodedTitle = encodeURIComponent(title);
    const encodedDescription = encodeURIComponent(description);
    const encodedHashtags = encodeURIComponent(hashtags.replace(/,\s*/g, ','));
    const encodedMediaUrl = encodeURIComponent(mediaUrl);

    // Social share URLs
    const socialLinks = {
        facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
        twitter: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}&hashtags=${encodedHashtags}`,
        pinterest: `https://pinterest.com/pin/create/button/?url=${encodedUrl}&description=${encodedDescription}&media=${encodedMediaUrl}`,
        linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
        whatsapp: `https://api.whatsapp.com/send?text=${encodedTitle}%20${encodedUrl}`,
        email: `mailto:?subject=${encodedTitle}&body=${encodedDescription}%20${encodedUrl}`
    };

    // Handle copy to clipboard functionality
    const copyToClipboard = () => {
        navigator.clipboard.writeText(url)
            .then(() => {
                setCopied(true);
                setShowTooltip('copy');
                setTimeout(() => {
                    setCopied(false);
                    setShowTooltip(null);
                }, 2000);
            })
            .catch(err => {
                console.error('Failed to copy: ', err);
            });
    };

    // Open share window
    const openShareWindow = (platform) => {
        if (platform === 'copy') {
            copyToClipboard();
            return;
        }

        const shareUrl = socialLinks[platform];
        if (!shareUrl) return;

        window.open(shareUrl, '_blank', 'width=600,height=400');
    };

    // Social media platform icons and info
    const platformsConfig = {
        facebook: {
            name: 'Facebook',
            icon: (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2.04C6.5 2.04 2 6.53 2 12.06c0 5.1 3.75 9.35 8.68 10.12v-7.15H7.9v-2.97h2.78V9.85c0-2.75 1.64-4.27 4.15-4.27.82 0 1.73.1 2.55.2v2.86h-1.45c-1.36 0-1.73.65-1.73 1.54v1.86h2.97l-.45 2.97h-2.52v7.15c4.92-.77 8.68-5.02 8.68-10.12 0-5.53-4.5-10.02-10-10.02z" />
                </svg>
            ),
            color: '#1877F2'
        },
        twitter: {
            name: 'Twitter',
            icon: (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M22.46 6c-.77.35-1.6.58-2.46.69.88-.53 1.56-1.37 1.88-2.38-.83.5-1.75.85-2.72 1.05C18.37 4.5 17.26 4 16 4c-2.35 0-4.27 1.92-4.27 4.29 0 .34.04.67.11.98C8.28 9.09 5.11 7.38 3 4.79c-.37.63-.58 1.37-.58 2.15 0 1.49.75 2.81 1.91 3.56-.71 0-1.37-.2-1.95-.5v.03c0 2.08 1.48 3.82 3.44 4.21a4.22 4.22 0 0 1-1.93.07 4.28 4.28 0 0 0 4 2.98 8.521 8.521 0 0 1-5.33 1.84c-.34 0-.68-.02-1.02-.06C3.44 20.29 5.7 21 8.12 21 16 21 20.33 14.46 20.33 8.79c0-.19 0-.37-.01-.56.84-.6 1.56-1.36 2.14-2.23z" />
                </svg>
            ),
            color: '#1DA1F2'
        },
        pinterest: {
            name: 'Pinterest',
            icon: (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M9.04 21.54c.96.29 1.93.46 2.96.46a10 10 0 0 0 10-10A10 10 0 0 0 12 2 10 10 0 0 0 2 12c0 4.25 2.67 7.9 6.44 9.34-.09-.78-.18-2.07 0-2.96l1.15-4.94s-.29-.58-.29-1.5c0-1.38.86-2.41 1.84-2.41.86 0 1.26.63 1.26 1.44 0 .86-.57 2.09-.86 3.33-.17.98.52 1.84 1.52 1.84 1.78 0 3.16-1.9 3.16-4.58 0-2.4-1.72-4.04-4.19-4.04-2.82 0-4.48 2.1-4.48 4.31 0 .86.28 1.73.74 2.3.09.06.09.14.06.29l-.29 1.09c0 .17-.11.23-.28.11-1.28-.56-2.02-2.38-2.02-3.85 0-3.16 2.24-6.03 6.56-6.03 3.44 0 6.12 2.47 6.12 5.75 0 3.44-2.13 6.2-5.18 6.2-.97 0-1.92-.52-2.26-1.13l-.67 2.37c-.23.86-.86 2.01-1.29 2.7v-.03z" />
                </svg>
            ),
            color: '#E60023'
        },
        linkedin: {
            name: 'LinkedIn',
            icon: (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.32 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.79M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z" />
                </svg>
            ),
            color: '#0077B5'
        },
        whatsapp: {
            name: 'WhatsApp',
            icon: (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.498 14.382c-.301-.15-1.767-.867-2.04-.966-.273-.101-.473-.15-.673.15-.197.295-.771.964-.944 1.162-.175.195-.349.21-.646.075-.3-.15-1.263-.465-2.403-1.485-.888-.795-1.484-1.77-1.66-2.07-.174-.3-.019-.465.13-.615.136-.135.301-.345.451-.523.146-.181.194-.301.297-.496.1-.21.049-.375-.025-.524-.075-.15-.672-1.62-.922-2.206-.24-.584-.487-.51-.672-.51-.172-.015-.371-.015-.571-.015-.2 0-.523.074-.797.359-.273.3-1.045 1.02-1.045 2.475s1.07 2.865 1.219 3.075c.149.195 2.105 3.195 5.1 4.485.714.3 1.27.48 1.704.629.714.227 1.365.195 1.88.121.574-.091 1.767-.721 2.016-1.426.255-.705.255-1.29.18-1.425-.074-.135-.27-.21-.57-.345m-5.446 7.443h-.016c-1.77 0-3.524-.48-5.055-1.38l-.36-.214-3.75.975 1.005-3.645-.239-.375a9.869 9.869 0 0 1-1.516-5.26c0-5.445 4.455-9.885 9.942-9.885a9.865 9.865 0 0 1 7.022 2.92 9.788 9.788 0 0 1 2.896 6.965c-.004 5.445-4.455 9.885-9.935 9.885M20.52 3.449C18.24 1.245 15.24 0 12.045 0 5.463 0 .104 5.334.101 11.893c0 2.096.549 4.14 1.595 5.945L0 24l6.335-1.652a12.062 12.062 0 0 0 5.71 1.447h.006c6.585 0 11.946-5.336 11.949-11.896 0-3.176-1.24-6.165-3.495-8.411" />
                </svg>
            ),
            color: '#25D366'
        },
        email: {
            name: 'Email',
            icon: (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
                </svg>
            ),
            color: '#EA4335'
        },
        copy: {
            name: 'Copy Link',
            icon: (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" />
                </svg>
            ),
            color: '#718096'
        }
    };

    // Button renderer
    const renderButtons = () => {
        return platforms.map(platform => {
            if (!platformsConfig[platform]) return null;

            const config = platformsConfig[platform];

            return (
                <button
                    key={platform}
                    onClick={() => openShareWindow(platform)}
                    className="share-button"
                    onMouseEnter={() => setShowTooltip(platform)}
                    onMouseLeave={() => setShowTooltip(null)}
                    style={{ backgroundColor: config.color }}
                    aria-label={`Share on ${config.name}`}
                >
                    <span className="icon">{config.icon}</span>
                    {showText && <span className="text">{config.name}</span>}

                    {/* Tooltip */}
                    {showTooltip === platform && (
                        <span className="tooltip">
                            {platform === 'copy'
                                ? (copied ? 'Copied!' : 'Copy link')
                                : `Share on ${config.name}`}
                        </span>
                    )}
                </button>
            );
        });
    };

    return (
        <div className={`social-share-buttons ${layout} ${!showText ? 'icons-only' : ''}`}>
            {renderButtons()}
        </div>
    );
};

export default SocialShareButtons;