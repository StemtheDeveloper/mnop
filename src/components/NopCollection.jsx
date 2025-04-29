import React, { useState, useEffect } from 'react';
import { getUserNopCollection } from '../services/nopService';
import { useUser } from '../context/UserContext';
import LoadingSpinner from './LoadingSpinner';
import '../styles/components/NopCollection.css';

const NopCollection = ({ userId }) => {
    const [nops, setNops] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const { currentUser } = useUser();

    // Use current user ID if no userId is provided
    const targetUserId = userId || (currentUser?.uid);

    useEffect(() => {
        const fetchNops = async () => {
            if (!targetUserId) return;

            setLoading(true);

            try {
                const nopCollection = await getUserNopCollection(targetUserId);
                setNops(nopCollection);
            } catch (err) {
                console.error('Error fetching nop collection:', err);
                setError('Failed to load your Nop collection');
            } finally {
                setLoading(false);
            }
        };

        fetchNops();
    }, [targetUserId]);

    // Group nops by month for better organization
    const groupNopsByMonth = () => {
        const groups = {};

        nops.forEach(nop => {
            // Use the server timestamp from collectedAt if available
            const collectedAt = nop.collectedAt?.toDate?.() ||
                (nop.collectedAt?.seconds ? new Date(nop.collectedAt.seconds * 1000) : new Date());

            const monthYear = collectedAt.toLocaleString('default', { month: 'long', year: 'numeric' });

            if (!groups[monthYear]) {
                groups[monthYear] = [];
            }

            groups[monthYear].push({
                ...nop,
                collectedDate: collectedAt
            });
        });

        // Sort each group by date (newest first) and convert to array format
        return Object.entries(groups)
            .map(([monthYear, groupNops]) => ({
                monthYear,
                nops: groupNops.sort((a, b) => b.collectedDate - a.collectedDate)
            }))
            .sort((a, b) => {
                // Extract month and year from the key
                const [monthA, yearA] = a.monthYear.split(' ');
                const [monthB, yearB] = b.monthYear.split(' ');

                // Compare years first
                if (yearA !== yearB) {
                    return parseInt(yearB) - parseInt(yearA);
                }

                // If years are the same, compare months
                const months = ['January', 'February', 'March', 'April', 'May', 'June',
                    'July', 'August', 'September', 'October', 'November', 'December'];

                return months.indexOf(monthB) - months.indexOf(monthA);
            });
    };

    if (loading) {
        return (
            <div className="nop-collection loading">
                <LoadingSpinner />
                <p>Loading your Nop collection...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="nop-collection error">
                <p>{error}</p>
            </div>
        );
    }

    if (nops.length === 0) {
        return (
            <div className="nop-collection empty">
                <h3>No Nops Collected Yet</h3>
                <p>Start collecting your Nops from the "Nop Of The Day" section in the footer.</p>
            </div>
        );
    }

    const groupedNops = groupNopsByMonth();

    return (
        <div className="nop-collection">
            <div className="nop-stats">
                <div className="nop-stat">
                    <span className="stat-number">{nops.length}</span>
                    <span className="stat-label">Total Collected</span>
                </div>
                <div className="nop-stat">
                    <span className="stat-number">
                        {new Set(nops.map(nop => nop.id)).size}
                    </span>
                    <span className="stat-label">Unique Nops</span>
                </div>
            </div>

            <div className="nop-groups">
                {groupedNops.map((group, groupIndex) => (
                    <div key={groupIndex} className="nop-group">
                        <h3 className="group-title">{group.monthYear}</h3>
                        <div className="nop-grid">
                            {group.nops.map((nop, nopIndex) => (
                                <div key={`${nop.id}-${nopIndex}`} className="nop-item">
                                    <div className="nop-image">
                                        {!nop.imageURL && !nop.imageUrl && !nop.image ? (
                                            <div className="nop-placeholder">
                                                {nop.name?.charAt(0) || '?'}
                                            </div>
                                        ) : (
                                            <img
                                                src={nop.imageURL || nop.imageUrl || nop.image}
                                                alt={nop.name}
                                                onError={(e) => {
                                                    console.error(`Failed to load image for Nop: ${nop.name}`);
                                                    e.target.onerror = null;
                                                    e.target.src = 'https://via.placeholder.com/100';
                                                }}
                                            />
                                        )}
                                    </div>
                                    <div className="nop-details">
                                        <h4 className="nop-name">{nop.name}</h4>
                                        <p className="nop-date">
                                            {nop.collectedDate.toLocaleDateString('en-US', {
                                                day: 'numeric',
                                                month: 'short'
                                            })}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default NopCollection;