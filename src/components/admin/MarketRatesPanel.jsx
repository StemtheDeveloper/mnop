import React, { useState, useEffect } from 'react';
import interestService from '../../services/interestService';
import externalApiService from '../../services/externalApiService';


const MarketRatesPanel = () => {
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(false);
    const [updateLoading, setUpdateLoading] = useState(false);
    const [marketRates, setMarketRates] = useState(null);
    const [currentConfig, setCurrentConfig] = useState(null);
    const [useMarketRate, setUseMarketRate] = useState(true);
    const [manualOffset, setManualOffset] = useState(0);
    const [error, setError] = useState(null);
    const [message, setMessage] = useState(null);

    useEffect(() => {
        loadData();
    }, []); const loadData = async () => {
        setLoading(true);
        setError(null);

        try {
            const configResult = await interestService.getInterestRates();
            if (configResult.success) {
                setCurrentConfig(configResult.data);

                // Initialize state based on current config
                if (configResult.data.useMarketRate !== undefined) {
                    setUseMarketRate(configResult.data.useMarketRate);
                }
                if (configResult.data.manualRateOffset !== undefined) {
                    setManualOffset(configResult.data.manualRateOffset);
                }
            } else {
                setError('Failed to load current interest rate configuration');
            }
        } catch (err) {
            setError('Error loading interest rate configuration');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const fetchLatestRates = async () => {
        setFetching(true);
        setError(null);
        setMessage(null);

        try {
            const result = await externalApiService.fetchNZFinancialIndicators();
            if (result.success) {
                setMarketRates(result.data);
                setMessage('Successfully fetched latest NZ market rates');
            } else {
                setError(result.error || 'Failed to fetch NZ market rates');
            }
        } catch (err) {
            setError('Error fetching market rates');
            console.error(err);
        } finally {
            setFetching(false);
        }
    };

    const updateRates = async () => {
        setUpdateLoading(true);
        setError(null);
        setMessage(null);

        try {
            const result = await interestService.updateInterestRatesFromMarket(
                useMarketRate,
                parseFloat(manualOffset)
            );

            if (result.success) {
                setCurrentConfig(result.data);
                setMessage('Interest rates updated successfully!');
                await loadData(); // Reload data to ensure we have the latest
            } else {
                setError(result.error || 'Failed to update interest rates');
            }
        } catch (err) {
            setError('Error updating interest rates');
            console.error(err);
        } finally {
            setUpdateLoading(false);
        }
    };

    const formatPercentage = (value) => {
        if (value === null || value === undefined) return 'N/A';
        return `${value.toFixed(3)}%`;
    };

    const formatDate = (date) => {
        if (!date) return 'N/A';
        const d = new Date(date);
        return d.toLocaleString();
    };

    if (loading) {
        return (
            <div className="market-rates-panel loading">
                <div className="loading-spinner"></div>
                <p>Loading interest rate configuration...</p>
            </div>
        );
    }

    return (
        <div className="market-rates-panel">
            <h2>New Zealand Market Interest Rates</h2>

            {error && <div className="error-message">{error}</div>}
            {message && <div className="success-message">{message}</div>}

            <div className="rates-control-panel">
                <div className="fetch-rates-section">
                    <button
                        className="fetch-rates-button"
                        onClick={fetchLatestRates}
                        disabled={fetching}
                    >
                        {fetching ? 'Fetching...' : 'Fetch Latest NZ Market Rates'}
                    </button>

                    {currentConfig?.marketData && (
                        <div className="last-fetch-info">
                            Last fetched: {formatDate(currentConfig.marketData.fetchedAt)}
                        </div>
                    )}
                </div>

                {marketRates && (
                    <div className="market-rates-info">
                        <h3>Current NZ Market Rates</h3>
                        <div className="rates-grid">
                            <div className="rate-item">
                                <div className="rate-name">Official Cash Rate (OCR)</div>
                                <div className="rate-value">
                                    {formatPercentage(marketRates.ocrRate?.value)}
                                </div>
                            </div>
                            <div className="rate-item">
                                <div className="rate-name">90-Day Bank Bill Rate</div>
                                <div className="rate-value">
                                    {formatPercentage(marketRates.nz90DayRate?.value)}
                                </div>
                            </div>
                            <div className="rate-item">
                                <div className="rate-name">6-Month Bank Bill Rate</div>
                                <div className="rate-value">
                                    {formatPercentage(marketRates.nz6MonthRate?.value)}
                                </div>
                            </div>
                        </div>
                        <div className="fetched-at">
                            Fetched at: {formatDate(marketRates.fetchedAt)}
                            {marketRates.source === 'backup' && (
                                <span className="backup-note"> (using backup rates)</span>
                            )}
                        </div>
                    </div>
                )}
            </div>

            <div className="rate-config-section">
                <h3>Interest Rate Configuration</h3>

                <div className="rate-options">
                    <div className="rate-option">
                        <input
                            type="radio"
                            id="useMarketRate"
                            name="rateSource"
                            checked={useMarketRate}
                            onChange={() => setUseMarketRate(true)}
                        />
                        <label htmlFor="useMarketRate">Use NZ Market Rate (with offset)</label>
                    </div>

                    <div className="rate-option">
                        <input
                            type="radio"
                            id="useManualRate"
                            name="rateSource"
                            checked={!useMarketRate}
                            onChange={() => setUseMarketRate(false)}
                        />
                        <label htmlFor="useManualRate">Use Manual Rate</label>
                    </div>
                </div>

                {useMarketRate && (
                    <div className="rate-adjustment">
                        <label htmlFor="manualOffset">Market Rate Offset (percentage points):</label>
                        <input
                            id="manualOffset"
                            type="number"
                            value={manualOffset}
                            onChange={e => setManualOffset(e.target.value)}
                            step="0.1"
                        />
                        <div className="offset-info">
                            Add or subtract from OCR rate (e.g., +0.5 adds half a percent)
                        </div>
                    </div>
                )}

                <div className="current-rate-info">
                    <div className="info-item">
                        <label>Current Daily Rate:</label>
                        <span>{currentConfig && formatPercentage(currentConfig.dailyRate * 100)}</span>
                    </div>
                    <div className="info-item">
                        <label>Effective Annual Rate:</label>
                        <span>{currentConfig && formatPercentage(currentConfig.dailyRate * 365 * 100)}</span>
                    </div>
                    <div className="info-item">
                        <label>Minimum Balance:</label>
                        <span>${currentConfig?.minBalance || 0}</span>
                    </div>
                </div>

                <button
                    className="update-rates-button"
                    onClick={updateRates}
                    disabled={updateLoading}
                >
                    {updateLoading ? 'Updating...' : 'Update Interest Rates'}
                </button>
            </div>

            <div className="market-rates-info-box">
                <h4>About NZ Market-Based Interest Rates</h4>
                <ul>
                    <li>The system automatically sets interest rates based on New Zealand market indicators.</li>
                    <li>The base rate used is the RBNZ Official Cash Rate (OCR), the primary benchmark in New Zealand.</li>
                    <li>A small spread is added to the OCR to make it competitive with retail banking rates.</li>
                    <li>You can adjust the offset to fine-tune the offered rate.</li>
                    <li>Changes are applied during the next interest calculation cycle.</li>
                    <li>Data is sourced from the Reserve Bank of New Zealand (RBNZ).</li>
                </ul>
            </div>
        </div>
    );
};

export default MarketRatesPanel;
