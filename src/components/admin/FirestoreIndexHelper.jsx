import React, { useState } from 'react';
import '../../styles/AdminTools.css';

/**
 * Component for helping admins create necessary Firestore indexes
 */
const FirestoreIndexHelper = () => {
    const [showInstructions, setShowInstructions] = useState(false);
    const [indexStatus, setIndexStatus] = useState({});

    // List of required indexes for the application
    const requiredIndexes = [
        {
            id: 'transactions-userId-createdAt',
            description: 'Transactions by user ordered by date',
            collection: 'transactions',
            fields: [
                { field: 'userId', order: 'ASCENDING' },
                { field: 'createdAt', order: 'DESCENDING' }
            ],
            url: 'https://console.firebase.google.com/v1/r/project/m-nop-39b2f/firestore/indexes?create_composite=ClBwcm9qZWN0cy9tLW5vcC0zOWIyZi9kYXRhYmFzZXMvKGRlZmF1bHQpL2NvbGxlY3Rpb25Hcm91cHMvdHJhbnNhY3Rpb25zL2luZGV4ZXMvXxABGgoKBnVzZXJJZBABGg0KCWNyZWF0ZWRBdBACGgwKCF9fbmFtZV9fEAI'
        },
        {
            id: 'transactions-category-userId-createdAt',
            description: 'Interest transactions by category and user ordered by date',
            collection: 'transactions',
            fields: [
                { field: 'category', order: 'ASCENDING' },
                { field: 'userId', order: 'ASCENDING' },
                { field: 'createdAt', order: 'DESCENDING' }
            ],
            url: 'https://console.firebase.google.com/v1/r/project/m-nop-39b2f/firestore/indexes?create_composite=ClBwcm9qZWN0cy9tLW5vcC0zOWIyZi9kYXRhYmFzZXMvKGRlZmF1bHQpL2NvbGxlY3Rpb25Hcm91cHMvdHJhbnNhY3Rpb25zL2luZGV4ZXMvXxABGgwKCGNhdGVnb3J5EAEaCgoGdXNlcklkEAEaDQoJY3JlYXRlZEF0EAIaDAoIX19uYW1lX18QAg'
        },
        {
            id: 'productViews-productId-timestamp',
            description: 'Product views by product ID ordered by timestamp',
            collection: 'productViews',
            fields: [
                { field: 'productId', order: 'ASCENDING' },
                { field: 'timestamp', order: 'DESCENDING' }
            ],
            url: 'https://console.firebase.google.com/v1/r/project/m-nop-39b2f/firestore/indexes?create_composite=ClBwcm9qZWN0cy9tLW5vcC0zOWIyZi9kYXRhYmFzZXMvKGRlZmF1bHQpL2NvbGxlY3Rpb25Hcm91cHMvcHJvZHVjdFZpZXdzL2luZGV4ZXMvXxABGg0KCXByb2R1Y3RJZBABGg0KCXRpbWVzdGFtcBACGgwKCF9fbmFtZV9fEAI'
        }
    ];

    const markIndexCreated = (indexId) => {
        setIndexStatus(prevStatus => ({
            ...prevStatus,
            [indexId]: 'created'
        }));
    };

    return (
        <div className="admin-panel firestore-index-helper">
            <div className="panel-header">
                <h3>Firestore Index Management</h3>
                <button
                    className="toggle-instructions-btn"
                    onClick={() => setShowInstructions(!showInstructions)}
                >
                    {showInstructions ? 'Hide Instructions' : 'Show Instructions'}
                </button>
            </div>

            {showInstructions && (
                <div className="instructions-box">
                    <h4>⚠️ Important: Fix Missing Indexes</h4>
                    <p>Your wallet transactions require indexes to display properly. Follow these steps to create them:</p>
                    <ol>
                        <li>Click on the "Create Index" button for each index below.</li>
                        <li>This will open the Firebase console in a new tab.</li>
                        <li>Sign in with your Firebase account if prompted.</li>
                        <li>Review the index configuration and click "Create Index" in the Firebase console.</li>
                        <li>Wait for the index to finish building (this may take a few minutes).</li>
                        <li>Once the index is active, the related functionality in the app will work properly.</li>
                    </ol>
                    <p><strong>Note:</strong> Until these indexes are created, the wallet page will use a fallback approach that might be slower or have limited functionality.</p>
                </div>
            )}

            <div className="index-list">
                <h4>Required Indexes</h4>
                <div className="index-table">
                    <table>
                        <thead>
                            <tr>
                                <th>Description</th>
                                <th>Collection</th>
                                <th>Fields</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {requiredIndexes.map((index) => (
                                <tr key={index.id} className={indexStatus[index.id] === 'created' ? 'index-created' : ''}>
                                    <td>{index.description}</td>
                                    <td>{index.collection}</td>
                                    <td>
                                        {index.fields.map((field, i) => (
                                            <div key={i}>
                                                {field.field} ({field.order})
                                            </div>
                                        ))}
                                    </td>
                                    <td>
                                        <div className="index-actions">
                                            <a
                                                href={index.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="create-index-btn"
                                            >
                                                Create Index
                                            </a>
                                            <button
                                                className={`mark-created-btn ${indexStatus[index.id] === 'created' ? 'active' : ''}`}
                                                onClick={() => markIndexCreated(index.id)}
                                            >
                                                {indexStatus[index.id] === 'created' ? 'Created ✓' : 'Mark as Created'}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="index-note">
                <p><strong>Important:</strong> After creating any index, it may take a few minutes for the index to become active.
                    During this time, queries that depend on the index may still fail. Check the Firebase console for index building status.</p>
            </div>
        </div>
    );
};

export default FirestoreIndexHelper;
