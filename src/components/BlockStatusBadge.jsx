import React from 'react';
import { useUser } from '../context/UserContext';
import '../styles/BlockStatusBadge.css';

/**
 * A badge to indicate blocked user status
 * 
 * @param {object} props
 * @param {string} props.userId - ID of the user to check
 * @param {string} props.size - Badge size: 'sm', 'md', or 'lg'
 */
const BlockStatusBadge = ({ userId, size = 'md' }) => {
    const { isUserBlocked, shouldBlockContent } = useUser();

    // If not blocked, don't render anything
    if (!userId || !isUserBlocked || !isUserBlocked(userId)) {
        return null;
    }

    // Determine if content is blocked too
    const blocksContent = shouldBlockContent(userId);

    return (
        <div className={`block-status-badge size-${size}`}>
            <span className="block-status-icon">🚫</span>
            <span className="block-status-text">
                {blocksContent ? 'Blocked & Content Hidden' : 'Blocked'}
            </span>
        </div>
    );
};

export default BlockStatusBadge;
