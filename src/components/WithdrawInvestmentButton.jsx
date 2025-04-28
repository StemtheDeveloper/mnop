import React, { useState, useEffect } from 'react';
import InvestmentWithdrawalModal from './InvestmentWithdrawalModal';
import investmentService from '../services/investmentService';
import '../styles/WithdrawInvestmentButton.css';

const WithdrawInvestmentButton = ({ investment, onWithdrawalStatusChange }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isPendingWithdrawal, setIsPendingWithdrawal] = useState(false);
    const [withdrawalDate, setWithdrawalDate] = useState(null);

    useEffect(() => {
        // Check if the investment is already pending withdrawal
        if (investment && investment.status === 'pending_withdrawal') {
            setIsPendingWithdrawal(true);

            if (investment.scheduledWithdrawalDate) {
                // Convert Firebase timestamp to Date
                const date = new Date(investment.scheduledWithdrawalDate.seconds * 1000);
                setWithdrawalDate(date);
            }
        } else {
            setIsPendingWithdrawal(false);
            setWithdrawalDate(null);
        }
    }, [investment]);

    const handleOpenModal = () => {
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
    };

    const handleWithdrawalRequested = (investmentId, date) => {
        setIsPendingWithdrawal(true);
        setWithdrawalDate(date);

        if (onWithdrawalStatusChange) {
            onWithdrawalStatusChange(investmentId, 'pending_withdrawal', date);
        }
    };

    const handleCancelWithdrawal = async () => {
        try {
            const result = await investmentService.cancelPullFundingRequest(
                investment.id,
                investment.userId
            );

            if (result.success) {
                setIsPendingWithdrawal(false);
                setWithdrawalDate(null);

                if (onWithdrawalStatusChange) {
                    onWithdrawalStatusChange(investment.id, 'active', null);
                }
            } else {
                alert(result.error || 'Failed to cancel withdrawal request');
            }
        } catch (error) {
            console.error("Error canceling withdrawal request:", error);
            alert('An error occurred while canceling your withdrawal request');
        }
    };

    const formatDate = (date) => {
        if (!date) return '';
        return date.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    // Don't render anything if investment is null or undefined
    if (!investment) return null;

    // Don't allow withdrawal if product is fully funded
    const isFullyFunded = investment.productCurrentFunding >= investment.productFundingGoal;

    return (
        <div className="withdraw-investment-container">
            {isPendingWithdrawal ? (
                <div className="pending-withdrawal-notice">
                    <div className="notice-content">
                        <span className="withdrawal-status">Withdrawal Pending</span>
                        <p>Your investment will be returned on <strong>{formatDate(withdrawalDate)}</strong></p>
                    </div>
                    <button
                        className="cancel-withdrawal-button"
                        onClick={handleCancelWithdrawal}
                    >
                        Cancel Withdrawal
                    </button>
                </div>
            ) : (
                <button
                    className="withdraw-investment-button"
                    onClick={handleOpenModal}
                    disabled={isFullyFunded}
                    title={isFullyFunded ? "Cannot withdraw from a fully funded product" : "Withdraw your investment"}
                >
                    Withdraw Investment
                </button>
            )}

            {isModalOpen && (
                <InvestmentWithdrawalModal
                    investment={investment}
                    onClose={handleCloseModal}
                    onWithdrawalRequested={handleWithdrawalRequested}
                />
            )}
        </div>
    );
};

export default WithdrawInvestmentButton;