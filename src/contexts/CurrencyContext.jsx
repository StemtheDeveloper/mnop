// src/contexts/CurrencyContext.jsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import currencyService from '../services/currencyService';

// Create currency context
const CurrencyContext = createContext();

// Custom hook to use the currency context
export const useCurrency = () => {
    return useContext(CurrencyContext);
};

export const CurrencyProvider = ({ children }) => {
    // Default to USD
    const [currency, setCurrency] = useState('USD');
    const [currencies, setCurrencies] = useState(currencyService.getCurrencies());
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Load saved currency preference from localStorage if available
    useEffect(() => {
        const savedCurrency = localStorage.getItem('preferredCurrency');
        if (savedCurrency && currencies[savedCurrency]) {
            setCurrency(savedCurrency);
        }

        fetchRates();
    }, []);

    // Fetch exchange rates
    const fetchRates = async () => {
        try {
            setLoading(true);
            setError(null);

            // Check if rates need updating
            if (currencyService.needsUpdate()) {
                await currencyService.fetchExchangeRates();
            } else {
                // Load from service (which may already have rates)
                if (!currencyService.getLastFetched()) {
                    await currencyService.loadRatesFromFirestore();
                }
            }

            // Update currencies state with fresh rates
            setCurrencies(currencyService.getCurrencies());
            setLoading(false);
        } catch (err) {
            console.error('Error fetching currency rates:', err);
            setError('Failed to load exchange rates');
            setLoading(false);
        }
    };

    // Change active currency and save to localStorage
    const changeCurrency = (currencyCode) => {
        if (currencies[currencyCode]) {
            setCurrency(currencyCode);
            localStorage.setItem('preferredCurrency', currencyCode);
        }
    };

    // Format amount according to currently selected currency
    const formatAmount = (amount, options = {}) => {
        if (amount === undefined || amount === null) {
            return '';
        }

        // Apply conversion if the amount is in USD (our base currency)
        const convertedAmount = currencyService.convertFromUSD(amount, currency);

        // Format according to the selected currency
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency,
            minimumFractionDigits: options.minimumFractionDigits ?? 2,
            maximumFractionDigits: options.maximumFractionDigits ?? 2,
            ...options
        }).format(convertedAmount);
    };

    // Convert amount from the selected currency to USD (for storing in DB)
    const convertToUSD = (amount) => {
        return currencyService.convertToUSD(amount, currency);
    };

    // Get current currency symbol
    const getCurrencySymbol = () => {
        return currencies[currency]?.symbol || '$';
    };

    // Context value
    const value = {
        currency,
        currencies,
        loading,
        error,
        fetchRates,
        changeCurrency,
        formatAmount,
        convertToUSD,
        getCurrencySymbol,
        lastUpdated: currencyService.getLastFetched()
    };

    return (
        <CurrencyContext.Provider value={value}>
            {children}
        </CurrencyContext.Provider>
    );
};

export default CurrencyProvider;