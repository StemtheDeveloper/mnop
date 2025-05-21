import React from 'react';
import { useUser } from '../context/UserContext';
import '../styles/BlockedContentIndicator.css';

/**
 * Component to show a placeholder for blocked content
 * 
 * @param {object} props
 * @param {string} props.userId - ID of the user who created the content
 * @param {string} props.contentType - Type of content (comment, review, message, etc.)
 * @param {function} props.onUnblock - Optional callback when user clicks unblock
 * @param {function} props.onShowContent - Optional callback when user wants to view content anyway
 */
const BlockedContentIndicator = ({ userId, contentType = 'content', onUnblock, onShowContent }) => {
    const { isUserBlocked, unblockUser, currentUser } = useUser();

    const handleUnblock = async () => {
        if (onUnblock) {
            onUnblock(userId);
        } else if (currentUser) {
            await unblockUser(userId);
        }
    };

    const handleShowContent = () => {
        if (onShowContent) {
            onShowContent(userId);
        }
    };

    return (
        <div className="blocked-content-indicator">
            <div className="blocked-content-icon">
                <i className="fa fa-ban"></i>
            </div>
            <div className="blocked-content-message">
                <p>This {contentType} is from a blocked user</p>
                <div className="blocked-content-actions">
                    <button className="blocked-action-btn show-btn" onClick={handleShowContent}>
                        Show anyway
                    </button>
                    <button className="blocked-action-btn unblock-btn" onClick={handleUnblock}>
                        Unblock user
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BlockedContentIndicator;
