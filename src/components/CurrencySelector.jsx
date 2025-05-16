// src/components/CurrencySelector.jsx
import React, { useState, memo } from 'react';
import { useCurrency } from '../context/CurrencyContext';


const CurrencySelector = ({ compact = false }) => {
    const {
        availableCurrencies,
        currentCurrency,
        changeCurrency,
        loading,
    } = useCurrency();

    const [isOpen, setIsOpen] = useState(false);

    const toggleDropdown = () => {
        setIsOpen(!isOpen);
    };

    const handleCurrencyChange = (currencyCode) => {
        changeCurrency(currencyCode);
        setIsOpen(false);
    };

    if (loading) {
        return <div className="currency-selector-loading">Loading...</div>;
    }

    return (
        <div className={`currency-selector ${compact ? 'compact' : ''}`}>
            <div className="selected-currency" onClick={toggleDropdown}>
                <span className="currency-code">{currentCurrency}</span>
                {!compact && (
                    <span className="currency-name">
                        {availableCurrencies[currentCurrency]?.name || 'Unknown Currency'}
                    </span>
                )}
                <span className="dropdown-arrow">{isOpen ? '▲' : '▼'}</span>
            </div>

            {isOpen && (
                <div className="currency-dropdown">
                    {Object.entries(availableCurrencies).map(([code, details]) => (
                        <div
                            key={code}
                            className={`currency-option ${code === currentCurrency ? 'selected' : ''}`}
                            onClick={() => handleCurrencyChange(code)}
                        >
                            <span className="currency-symbol">{details.symbol}</span>
                            <span className="currency-code">{code}</span>
                            {!compact && <span className="currency-name">{details.name}</span>}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// Memoize the component with a comparison function
const areEqual = (prevProps, nextProps) => {
    // Only rerender if the compact prop changes
    return prevProps.compact === nextProps.compact;
};

export default memo(CurrencySelector, areEqual);