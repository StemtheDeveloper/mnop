import React, { useState, useEffect } from 'react';
import { useUser } from '../context/UserContext';
import productTrendingService from '../services/productTrendingService';


const TrendingExtensionButton = ({ product }) => {
    const { currentUser, hasRole } = useUser();
    const [isTrending, setIsTrending] = useState(false);
    const [trendData, setTrendData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [showDetails, setShowDetails] = useState(false);

    // Check if user is the designer of this product
    const isDesigner = currentUser?.uid === product.designerId;

    // Check if product can be extended (is active and user is the designer)
    const canRequestExtension =
        isDesigner &&
        product.status === 'active' &&
        new Date(product.deadline?.seconds * 1000) > new Date();

    useEffect(() => {
        const checkTrendingStatus = async () => {
            if (!product?.id || !isDesigner) return;

            try {
                const { success, data } = await productTrendingService.checkProductTrendingStatus(product.id);
                if (success) {
                    setTrendData(data);
                    // Full trending status will be checked server-side when requesting extension
                }
            } catch (err) {
                console.error('Error checking trending status:', err);
            }
        };

        // Only run this check for designers of the product
        if (isDesigner) {
            checkTrendingStatus();
        }
    }, [product.id, isDesigner]);

    const handleExtensionRequest = async () => {
        if (!canRequestExtension) return;

        setLoading(true);
        setResult(null);

        try {
            const response = await productTrendingService.requestDeadlineExtension(product.id);

            setResult({
                success: response.success,
                message: response.data.message || response.error
            });

            if (response.success) {
                // Update trend data with server result
                setTrendData(response.data.trendData);
                setIsTrending(true);
            } else if (response.data?.trendData) {
                // Even if not successful, we might have trend data
                setTrendData(response.data.trendData);
            }
        } catch (err) {
            setResult({
                success: false,
                message: err.message || 'An error occurred'
            });
        } finally {
            setLoading(false);
        }
    };

    // Only show this component to designers of the product
    if (!isDesigner) return null;

    // Format date for display
    const formatDate = (timestamp) => {
        if (!timestamp) return 'N/A';

        const date = new Date(timestamp);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    // Get current deadline
    const currentDeadline = product.deadline?.seconds
        ? formatDate(product.deadline.seconds * 1000)
        : 'N/A';

    // Calculate if product was extended previously
    const wasExtended = product.extensionHistory && product.extensionHistory.length > 0;

    // Check if maximum manual extensions reached
    const maxManualExtensionsReached = (product.manualExtensionCount || 0) >= 1;

    return (
        <div className="trending-extension-container">
            {wasExtended && (
                <div className="extension-badge">
                    <span className="badge">Deadline Extended</span>
                </div>
            )}

            {canRequestExtension && !maxManualExtensionsReached && (
                <div className="trending-extension-section">
                    <h4>Trending Product Extension</h4>
                    <p>
                        If your product is trending with high views or investment interest,
                        you may be eligible for a deadline extension.
                    </p>

                    <div className="extension-actions">
                        <button
                            onClick={handleExtensionRequest}
                            className="extension-button"
                            disabled={loading || maxManualExtensionsReached}
                        >
                            {loading ? 'Checking...' : 'Request Deadline Extension'}
                        </button>

                        <button
                            onClick={() => setShowDetails(!showDetails)}
                            className="trend-details-toggle"
                        >
                            {showDetails ? 'Hide Details' : 'Show Details'}
                        </button>
                    </div>

                    {showDetails && trendData && (
                        <div className="trend-details">
                            <h5>Trending Metrics</h5>
                            <ul>
                                <li className={trendData.views?.isTrending ? 'trending' : ''}>
                                    Views (7 days): {trendData.views?.count || 0}
                                    {trendData.views?.isTrending && <span className="trending-indicator">🔥</span>}
                                </li>
                                <li className={trendData.investments?.isTrending ? 'trending' : ''}>
                                    Investments (7 days): {trendData.investments?.count || '?'}
                                    {trendData.investments?.isTrending && <span className="trending-indicator">🔥</span>}
                                </li>
                                <li className={trendData.investmentAmount?.isTrending ? 'trending' : ''}>
                                    Investment Amount: ${trendData.investmentAmount?.amount || '?'}
                                    {trendData.investmentAmount?.isTrending && <span className="trending-indicator">🔥</span>}
                                </li>
                            </ul>

                            <p className="trend-note">
                                Your product needs to meet at least one trending criteria to qualify for extension.
                            </p>
                        </div>
                    )}

                    {result && (
                        <div className={`extension-result ${result.success ? 'success' : 'error'}`}>
                            {result.message}
                        </div>
                    )}

                    <div className="deadline-display">
                        Current deadline: <strong>{currentDeadline}</strong>
                    </div>
                </div>
            )}

            {maxManualExtensionsReached && (
                <div className="extension-note">
                    <p>You've already used your manual extension for this product.</p>
                    <p className="note-small">Products may still receive automatic extensions if they continue to trend.</p>
                </div>
            )}
        </div>
    );
};

export default TrendingExtensionButton;
