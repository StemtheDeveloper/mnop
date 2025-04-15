import React, { useState, useEffect } from 'react';
import { useUser } from '../context/UserContext';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';

const ManufacturingManagementQuotesPage = () => {
    const { userRole, userProfile } = useUser();
    const [quotes, setQuotes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Check if user has manufacturer role
    const userRoles = Array.isArray(userRole) ? userRole : [userRole];
    const isManufacturer = userRoles.includes('manufacturer');

    useEffect(() => {
        const fetchQuotes = async () => {
            if (!isManufacturer) return;

            try {
                setLoading(true);

                // Example query - adjust based on your actual database structure
                const quotesQuery = query(
                    collection(db, 'quotes'),
                    where('manufacturerId', '==', userProfile.uid)
                );

                const snapshot = await getDocs(quotesQuery);
                const quotesData = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));

                setQuotes(quotesData);
                setLoading(false);
            } catch (err) {
                console.error("Error fetching quotes:", err);
                setError("Failed to load quotes. Please try again later.");
                setLoading(false);
            }
        };

        fetchQuotes();
    }, [userProfile, isManufacturer]);

    if (!isManufacturer) {
        return (
            <div className="role-error">
                <h2>Manufacturer Role Required</h2>
                <p>You need the manufacturer role to access this page.</p>
            </div>
        );
    }

    if (loading) {
        return <div className="loading">Loading quotes...</div>;
    }

    if (error) {
        return <div className="error-message">{error}</div>;
    }

    return (
        <div className="manufacturing-quotes-page">
            <h1>Manufacturing Management / Quotes</h1>

            {quotes.length === 0 ? (
                <p>No quotes found. When designers request manufacturing quotes, they'll appear here.</p>
            ) : (
                <div className="quotes-list">
                    {quotes.map(quote => (
                        <div key={quote.id} className="quote-item">
                            <h3>{quote.productName}</h3>
                            <p>Designer: {quote.designerName}</p>
                            <p>Requested: {new Date(quote.requestedAt.seconds * 1000).toLocaleDateString()}</p>
                            <div className="quote-actions">
                                <button className="btn-primary">View Details</button>
                                <button className="btn-secondary">Submit Quote</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div className="tools-section">
                <h2>Manufacturing Tools</h2>
                <div className="tool-buttons">
                    <button className="tool-button">Production Schedule</button>
                    <button className="tool-button">Material Calculator</button>
                    <button className="tool-button">Pricing Guide</button>
                </div>
            </div>
        </div>
    );
};

export default ManufacturingManagementQuotesPage;
