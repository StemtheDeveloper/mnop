import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import investmentService from '../services/investmentService';
import LoadingSpinner from './LoadingSpinner';
import '../styles/InvestmentWithdrawalModal.css';

const InvestmentWithdrawalModal = ({ investment, onClose, onWithdrawalRequested }) => {
    const [reason, setReason] = useState('');
    const [noticePeriod, setNoticePeriod] = useState(7); // Default to 7 days
    const [isLoading, setIsLoading] = useState(false);
    const [withdrawalDate, setWithdrawalDate] = useState(null);
    const [feedback, setFeedback] = useState({ message: '', type: '' });
    const [isConfirming, setIsConfirming] = useState(false);

    useEffect(() => {
        // Fetch the notice period from settings when component mounts
        const fetchNoticePeriod = async () => {
            try {
                const result = await investmentService.getNoticePeriod();
                if (result.success) {
                    setNoticePeriod(result.data.noticePeriodDays);
                    
                    // Calculate and set the withdrawal date
                    const date = new Date();
                    date.setDate(date.getDate() + result.data.noticePeriodDays);
                    setWithdrawalDate(date);
                }
            } catch (error) {
                console.error("Error fetching notice period:", error);
                // Use default of 7 days if there's an error
                const date = new Date();
                date.setDate(date.getDate() + 7);
                setWithdrawalDate(date);
            }
        };

        fetchNoticePeriod();
    }, []);

    const handleRequestWithdrawal = async () => {
        setIsLoading(true);
        setFeedback({ message: '', type: '' });

        try {
            const result = await investmentService.requestPullFunding(
                investment.id,
                investment.userId,
                reason
            );

            if (result.success) {
                setFeedback({
                    message: result.message,
                    type: 'success'
                });
                
                // Call the callback after successful request
                if (onWithdrawalRequested) {
                    onWithdrawalRequested(investment.id, result.withdrawalDate);
                }
                
                // Reset form state
                setIsConfirming(false);
            } else {
                setFeedback({
                    message: result.error || 'Failed to request withdrawal',
                    type: 'error'
                });
            }
        } catch (error) {
            console.error("Error requesting withdrawal:", error);
            setFeedback({
                message: error.message || 'An unexpected error occurred',
                type: 'error'
            });
        } finally {
            setIsLoading(false);
        }
    };

    const formatDate = (date) => {
        if (!date) return 'calculating...';
        return date.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    return (
        <Modal title="Withdraw Investment" onClose={onClose}>
            <div className="investment-withdrawal-modal">
                {feedback.message && (
                    <div className={`feedback-message ${feedback.type}`}>
                        {feedback.message}
                    </div>
                )}

                {!feedback.message || feedback.type === 'error' ? (
                    <>
                        <div className="investment-details">
                            <h3>Investment Details</h3>
                            <p><strong>Product:</strong> {investment.productName}</p>
                            <p><strong>Amount:</strong> ${investment.amount.toFixed(2)}</p>
                            <p><strong>Investment Date:</strong> {investment.createdAt ? new Date(investment.createdAt.seconds * 1000).toLocaleDateString() : 'Unknown'}</p>
                        </div>

                        <div className="withdrawal-notice">
                            <h3>Important Notice</h3>
                            <p>
                                Due to our withdrawal policy, your funds will be returned after a 
                                <strong> {noticePeriod}-day notice period</strong>. 
                                This gives product creators time to adjust to funding changes.
                            </p>
                            <p>
                                If you proceed, your funds will be returned to your wallet on:
                                <strong> {formatDate(withdrawalDate)}</strong>
                            </p>
                            <p>
                                You can cancel your withdrawal request at any time during this notice period.
                                If the product reaches its funding goal during the notice period, your withdrawal request 
                                will be automatically canceled.
                            </p>
                        </div>

                        {!isConfirming ? (
                            <>
                                <div className="withdrawal-reason">
                                    <label htmlFor="withdrawal-reason">Reason for withdrawal (optional):</label>
                                    <textarea
                                        id="withdrawal-reason"
                                        value={reason}
                                        onChange={(e) => setReason(e.target.value)}
                                        placeholder="Please let us know why you're withdrawing your investment..."
                                        rows={4}
                                    />
                                </div>

                                <div className="modal-actions">
                                    <button 
                                        className="cancel-button"
                                        onClick={onClose}
                                        disabled={isLoading}
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        className="proceed-button"
                                        onClick={() => setIsConfirming(true)}
                                        disabled={isLoading}
                                    >
                                        Proceed
                                    </button>
                                </div>
                            </>
                        ) : (
                            <div className="confirmation-step">
                                <h3>Confirm Withdrawal</h3>
                                <p>
                                    Are you sure you want to withdraw your investment of 
                                    <strong> ${investment.amount.toFixed(2)}</strong> from 
                                    <strong> {investment.productName}</strong>?
                                </p>

                                <div className="modal-actions">
                                    <button 
                                        className="back-button"
                                        onClick={() => setIsConfirming(false)}
                                        disabled={isLoading}
                                    >
                                        Back
                                    </button>
                                    <button 
                                        className="confirm-button"
                                        onClick={handleRequestWithdrawal}
                                        disabled={isLoading}
                                    >
                                        {isLoading ? (
                                            <>
                                                <LoadingSpinner size="small" />
                                                <span>Processing...</span>
                                            </>
                                        ) : (
                                            'Confirm Withdrawal'
                                        )}
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="success-actions">
                        <button 
                            className="close-button"
                            onClick={onClose}
                        >
                            Close
                        </button>
                    </div>
                )}
            </div>
        </Modal>
    );
};

export default InvestmentWithdrawalModal;