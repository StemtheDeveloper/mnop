import React, { useState, useEffect } from 'react';
import { useUser } from '../context/UserContext';

/**
 * A higher-order component that filters out content from blocked users
 * @param {Array} items - Array of items to be filtered
 * @param {string} creatorField - The name of the field in each item that contains the creator's ID
 * @returns {Array} - Filtered array excluding content from blocked users
 */
export const useBlockedContentFilter = (items, creatorField = 'designerId') => {
    const { isUserBlocked, shouldBlockContent } = useUser();
    const [filteredItems, setFilteredItems] = useState([]);

    useEffect(() => {
        if (!items || !Array.isArray(items)) {
            setFilteredItems([]);
            return;
        }

        // Filter out content from blocked users
        const filtered = items.filter(item => {
            const creatorId = item[creatorField];
            // Only filter if we have a creator ID and should block this content
            if (creatorId && isUserBlocked(creatorId)) {
                return !shouldBlockContent(creatorId);
            }
            // Otherwise, include the item
            return true;
        });

        setFilteredItems(filtered);
    }, [items, creatorField, isUserBlocked, shouldBlockContent]);

    return filteredItems;
};

/**
 * A higher-order component that wraps a component and filters its data prop
 * @param {Component} WrappedComponent - The component to wrap
 * @param {string} dataField - The name of the prop that contains the data array
 * @param {string} creatorField - The name of the field in each data item that contains the creator's ID
 * @returns {Component} - Enhanced component with filtered data
 */
export const withBlockedContentFilter = (
    WrappedComponent,
    dataField = 'data',
    creatorField = 'designerId'
) => {
    return function WithBlockedContentFilter(props) {
        const { isUserBlocked, shouldBlockContent } = useUser();
        const data = props[dataField];

        // If no data or not an array, pass through unchanged
        if (!data || !Array.isArray(data)) {
            return <WrappedComponent {...props} />;
        }

        // Filter out content from blocked users
        const filteredData = data.filter(item => {
            const creatorId = item[creatorField];
            // Only filter if we have a creator ID and should block this content
            if (creatorId && isUserBlocked(creatorId)) {
                return !shouldBlockContent(creatorId);
            }
            // Otherwise, include the item
            return true;
        });

        // Create new props with filtered data
        const updatedProps = {
            ...props,
            [dataField]: filteredData,
        };

        return <WrappedComponent {...updatedProps} />;
    };
};

export default {
    useBlockedContentFilter,
    withBlockedContentFilter
};
