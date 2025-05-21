import React from 'react';
import { useUser } from '../context/UserContext';
import '../styles/BlockedUsersFilter.css';

/**
 * A component that shows a notice about filtered content from blocked users
 * 
 * @param {object} props
 * @param {Array} props.allItems - All items before filtering
 * @param {Array} props.filteredItems - Items after filtering (excluding blocked content)
 * @param {string} props.contentType - Type of content ('products', 'posts', 'ideas', etc.)
 * @param {function} props.onTemporarilyUnblock - Callback to temporarily unblock all content
 */
const BlockedUsersFilter = ({
    allItems = [],
    filteredItems = [],
    contentType = 'items',
    onTemporarilyUnblock = null
}) => {
    const { temporarilyUnblockContent } = useUser();

    // If no items or no filtering happened, don't render anything
    if (!allItems.length || allItems.length === filteredItems.length) {
        return null;
    }

    // Calculate how many items were filtered out
    const filteredCount = allItems.length - filteredItems.length;

    const handleUnblockContent = () => {
        // If custom handler provided, use it
        if (onTemporarilyUnblock) {
            onTemporarilyUnblock();
            return;
        }

        // Otherwise use the default temporarilyUnblockContent function
        // This would require gathering all the user IDs that were blocked
        if (temporarilyUnblockContent) {
            // Extract unique user IDs from the filtered items
            const blockedUserIds = new Set();

            // Find IDs that are in allItems but not in filteredItems
            allItems.forEach(item => {
                const found = filteredItems.some(filteredItem =>
                    filteredItem.id === item.id
                );

                if (!found && item.userId) {
                    blockedUserIds.add(item.userId);
                }
            });

            // Temporarily unblock each user ID
            blockedUserIds.forEach(userId => {
                temporarilyUnblockContent(userId);
            });

            // Force a refresh of the page to show the unblocked content
            window.location.reload();
        }
    };

    return (
        <div className="blocked-users-filter">
            <div className="filter-info">
                <span className="filter-icon">🔍</span>
                <span className="filter-message">
                    {filteredCount} {contentType} {filteredCount === 1 ? 'was' : 'were'} hidden from blocked users
                </span>
            </div>
            <button className="show-all-button" onClick={handleUnblockContent}>
                Show All Content
            </button>
        </div>
    );
};

export default BlockedUsersFilter;
