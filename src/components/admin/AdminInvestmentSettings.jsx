import React, { useState, useEffect } from 'react';
import investmentService from '../../services/investmentService';
import '../../styles/AdminInvestmentSettings.css';

const AdminInvestmentSettings = () => {
    const [noticePeriod, setNoticePeriod] = useState(7); // Default to 7 days
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [feedback, setFeedback] = useState({ message: '', type: '' });

    useEffect(() => {
        // Fetch the current notice period setting when component mounts
        const fetchNoticePeriod = async () => {
            setIsLoading(true);
            try {
                const result = await investmentService.getNoticePeriod();
                if (result.success) {
                    setNoticePeriod(result.data.noticePeriodDays);
                } else {
                    setFeedback({
                        message: result.error || 'Failed to load notice period setting',
                        type: 'error'
                    });
                }
            } catch (err) {
                console.error('Error fetching notice period:', err);
                setFeedback({
                    message: 'Error loading settings: ' + (err.message || 'Unknown error'),
                    type: 'error'
                });
            } finally {
                setIsLoading(false);
            }
        };

        fetchNoticePeriod();
    }, []);

    const handleNoticePeriodChange = (e) => {
        // Parse value to make sure it's a valid number
        const value = parseInt(e.target.value, 10);
        if (!isNaN(value) && value >= 0) {
            setNoticePeriod(value);
        }
    };

    const handleSaveSettings = async () => {
        setIsSaving(true);
        setFeedback({ message: '', type: '' });

        try {
            const result = await investmentService.updateNoticePeriod(noticePeriod);
            
            if (result.success) {
                setFeedback({
                    message: result.message || 'Notice period updated successfully',
                    type: 'success'
                });
            } else {
                setFeedback({
                    message: result.error || 'Failed to update notice period',
                    type: 'error'
                });
            }
        } catch (err) {
            console.error('Error updating notice period:', err);
            setFeedback({
                message: 'Error saving settings: ' + (err.message || 'Unknown error'),
                type: 'error'
            });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="admin-investment-settings">
            <h2>Investment Settings</h2>
            
            {feedback.message && (
                <div className={`feedback-message ${feedback.type}`}>
                    {feedback.message}
                    <button 
                        className="dismiss-button" 
                        onClick={() => setFeedback({ message: '', type: '' })}
                    >
                        ×
                    </button>
                </div>
            )}
            
            <div className="settings-card">
                <h3>Investment Withdrawal Settings</h3>
                
                <div className="settings-section">
                    <p className="section-description">
                        Configure the notice period required for investors to withdraw their funding from a product.
                        This period gives designers time to adjust plans if necessary before funds are returned.
                    </p>
                    
                    {isLoading ? (
                        <div className="loading-indicator">Loading settings...</div>
                    ) : (
                        <div className="setting-item">
                            <label htmlFor="noticePeriod">Withdrawal Notice Period (days)</label>
                            <div className="input-with-suffix">
                                <input
                                    id="noticePeriod"
                                    type="number"
                                    min="0"
                                    value={noticePeriod}
                                    onChange={handleNoticePeriodChange}
                                    disabled={isSaving}
                                />
                                <span className="input-suffix">days</span>
                            </div>
                            <p className="setting-description">
                                The number of days an investor must wait after requesting to withdraw their investment
                                before funds are returned to their wallet. Only applies to products that haven't
                                reached their funding goal yet.
                            </p>
                        </div>
                    )}
                    
                    <div className="settings-actions">
                        <button 
                            className="save-button"
                            onClick={handleSaveSettings}
                            disabled={isLoading || isSaving}
                        >
                            {isSaving ? 'Saving...' : 'Save Settings'}
                        </button>
                    </div>
                </div>
            </div>
            
            <div className="settings-card">
                <h3>Information About Investment Withdrawals</h3>
                
                <div className="info-section">
                    <h4>Rules for Investment Withdrawals</h4>
                    <ul className="info-list">
                        <li>Investors can only withdraw from products that have not reached their funding goal yet.</li>
                        <li>Once a withdrawal is requested, there's a {noticePeriod}-day notice period before funds are returned.</li>
                        <li>Investors can cancel their withdrawal request at any time during the notice period.</li>
                        <li>If a product reaches its funding goal during the notice period, the withdrawal is automatically canceled.</li>
                        <li>After the notice period, funds are automatically returned to the investor's wallet.</li>
                    </ul>
                    
                    <h4>Impact of Withdrawal Notices</h4>
                    <p>
                        Setting an appropriate notice period helps balance investor flexibility with product development 
                        stability. A longer period gives designers more time to adjust to potential funding changes,
                        while a shorter period provides more liquidity for investors.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default AdminInvestmentSettings;