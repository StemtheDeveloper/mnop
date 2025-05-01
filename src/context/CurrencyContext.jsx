// filepath: c:\Users\GGPC\Desktop\mnop-app\src\context\CurrencyContext.jsx
import React, { createContext, useState, useContext, useEffect } from 'react';
import currencyService from '../services/currencyService';

const CurrencyContext = createContext();

export const useCurrency = () => useContext(CurrencyContext);

export const CurrencyProvider = ({ children }) => {
    const [availableCurrencies, setAvailableCurrencies] = useState({});
    const [exchangeRates, setExchangeRates] = useState({});
    const [currentCurrency, setCurrentCurrency] = useState('USD');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Fetch available currencies and exchange rates on component mount
    useEffect(() => {
        const initializeCurrency = async () => {
            setLoading(true);
            setError(null);

            try {
                // Get currencies
                const currenciesResult = await currencyService.getAvailableCurrencies();
                if (!currenciesResult.success) {
                    throw new Error(currenciesResult.error || 'Failed to fetch currencies');
                }
                setAvailableCurrencies(currenciesResult.data);

                // Get default currency from available currencies
                const currencyData = currenciesResult.data;
                const defaultCurrency = Object.keys(currencyData).find(
                    code => currencyData[code].default
                ) || 'USD';

                // Check if user has a saved preference
                const savedCurrency = localStorage.getItem('preferredCurrency');
                if (savedCurrency && currencyData[savedCurrency]) {
                    setCurrentCurrency(savedCurrency);
                } else {
                    setCurrentCurrency(defaultCurrency);
                }

                // Get exchange rates
                const ratesResult = await currencyService.getExchangeRates();
                if (!ratesResult.success) {
                    throw new Error(ratesResult.error || 'Failed to fetch exchange rates');
                }
                setExchangeRates(ratesResult.data);
            } catch (err) {
                console.error('Error initializing currency:', err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        initializeCurrency();
    }, []);

    // Update local storage when currency changes
    useEffect(() => {
        localStorage.setItem('preferredCurrency', currentCurrency);
    }, [currentCurrency]);

    /**
     * Change the current currency
     * @param {string} currencyCode - Currency code to change to
     */
    const changeCurrency = (currencyCode) => {
        if (availableCurrencies[currencyCode]) {
            setCurrentCurrency(currencyCode);
        } else {
            console.error(`Currency ${currencyCode} is not available`);
        }
    };

    /**
     * Format an amount in the current or specified currency
     * @param {number} amount - Amount to format
     * @param {string} currency - Currency code (optional, defaults to current currency)
     * @returns {string} Formatted currency string
     */
    const formatAmount = (amount, currency = currentCurrency) => {
        if (amount === null || amount === undefined) return '';

        const currencyInfo = availableCurrencies[currency];
        if (!currencyInfo) return `${amount} ${currency}`;

        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency,
            currencyDisplay: 'symbol'
        }).format(amount);
    };

    /**
     * Convert an amount from USD to the current currency
     * @param {number} amountInUSD - Amount in USD
     * @returns {number} Amount in current currency
     */
    const convertFromUSD = (amountInUSD) => {
        if (!exchangeRates?.rates || !exchangeRates.rates[currentCurrency]) {
            return amountInUSD; // Return original if rates not available
        }

        return amountInUSD * exchangeRates.rates[currentCurrency];
    };

    /**
     * Convert an amount from the current currency to USD
     * @param {number} amount - Amount in current currency
     * @returns {number} Amount in USD
     */
    const convertToUSD = (amount) => {
        if (!exchangeRates?.rates || !exchangeRates.rates[currentCurrency]) {
            return amount; // Return original if rates not available
        }

        return amount / exchangeRates.rates[currentCurrency];
    };

    /**
     * Convert an amount between any two currencies
     * @param {number} amount - Amount to convert
     * @param {string} fromCurrency - Source currency code
     * @param {string} toCurrency - Target currency code
     * @returns {number} Converted amount
     */
    const convert = (amount, fromCurrency, toCurrency) => {
        if (!exchangeRates?.rates) return amount;
        if (!exchangeRates.rates[fromCurrency] || !exchangeRates.rates[toCurrency]) {
            return amount;
        }

        // Convert to USD first, then to target currency
        const amountInUSD = amount / exchangeRates.rates[fromCurrency];
        return amountInUSD * exchangeRates.rates[toCurrency];
    };

    /**
     * Update exchange rates from external API
     * @returns {Promise<boolean>} Success status
     */
    const updateRates = async () => {
        try {
            const result = await currencyService.updateExchangeRates();
            if (result.success) {
                setExchangeRates(result.data);
                return true;
            }
            return false;
        } catch (err) {
            console.error('Error updating exchange rates:', err);
            return false;
        }
    };

    /**
     * Get the currency symbol for the current or specified currency
     * @param {string} currency - Currency code (optional)
     * @returns {string} Currency symbol
     */
    const getCurrencySymbol = (currency = currentCurrency) => {
        return availableCurrencies[currency]?.symbol || '$';
    };

    const value = {
        availableCurrencies,
        exchangeRates,
        currentCurrency,
        loading,
        error,
        changeCurrency,
        formatAmount,
        convertFromUSD,
        convertToUSD,
        convert,
        updateRates,
        getCurrencySymbol
    };

    return (
        <CurrencyContext.Provider value={value}>
            {children}
        </CurrencyContext.Provider>
    );
};

export default CurrencyContext;