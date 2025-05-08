// src/services/currencyService.js
import { db } from "../config/firebase";
import {
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  query,
  orderBy,
  limit,
  serverTimestamp,
} from "firebase/firestore";

/**
 * Service for handling currency exchange rates and conversions
 */
class CurrencyService {
  /**
   * Get available currencies
   * @returns {Promise<Object>} Object with currency codes as keys and names as values
   */
  async getAvailableCurrencies() {
    try {
      const currenciesRef = doc(db, "settings", "currencies");
      const currenciesDoc = await getDoc(currenciesRef);

      if (currenciesDoc.exists()) {
        return {
          success: true,
          data: currenciesDoc.data().available || {},
        };
      } else {
        // Initialize with default currencies if not exists
        const defaultCurrencies = {
          USD: { name: "US Dollar", symbol: "$", default: true },
          EUR: { name: "Euro", symbol: "€" },
          GBP: { name: "British Pound", symbol: "£" },
          NZD: { name: "New Zealand Dollar", symbol: "$" },
          AUD: { name: "Australian Dollar", symbol: "$" },
          CAD: { name: "Canadian Dollar", symbol: "$" },
          JPY: { name: "Japanese Yen", symbol: "¥" },
        };

        await setDoc(currenciesRef, {
          available: defaultCurrencies,
          updatedAt: serverTimestamp(),
        });

        return {
          success: true,
          data: defaultCurrencies,
        };
      }
    } catch (error) {
      console.error("Error fetching available currencies:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get current exchange rates
   * @returns {Promise<Object>} Exchange rates with USD as base
   */
  async getExchangeRates() {
    try {
      const ratesRef = doc(db, "settings", "exchangeRates");
      const ratesDoc = await getDoc(ratesRef);

      if (ratesDoc.exists()) {
        return {
          success: true,
          data: ratesDoc.data(),
        };
      } else {
        // Initialize with default rates if not exists
        const defaultRates = {
          base: "USD",
          rates: {
            USD: 1.0,
            EUR: 0.93,
            GBP: 0.79,
            NZD: 1.64,
            AUD: 1.52,
            CAD: 1.37,
            JPY: 154.37,
          },
          lastUpdated: serverTimestamp(),
        };

        await setDoc(ratesRef, defaultRates);

        return {
          success: true,
          data: defaultRates,
        };
      }
    } catch (error) {
      console.error("Error fetching exchange rates:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Update exchange rates from an external API
   * @returns {Promise<Object>} Updated exchange rates
   */
  async updateExchangeRates() {
    try {
      // In a real implementation, you would fetch from a real API like:
      // const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
      // const data = await response.json();

      // For this implementation, we'll use static data with slight variations
      // to simulate a real API call
      const variation = Math.random() * 0.05 - 0.025; // Random variation between -2.5% and +2.5%

      const newRates = {
        base: "USD",
        rates: {
          USD: 1.0,
          EUR: 0.93 * (1 + variation),
          GBP: 0.79 * (1 + variation),
          NZD: 1.64 * (1 + variation),
          AUD: 1.52 * (1 + variation),
          CAD: 1.37 * (1 + variation),
          JPY: 154.37 * (1 + variation),
        },
        lastUpdated: serverTimestamp(),
      };

      // Round all rates to 6 decimal places for consistency
      Object.keys(newRates.rates).forEach((currency) => {
        newRates.rates[currency] =
          Math.round(newRates.rates[currency] * 1000000) / 1000000;
      });

      // Save to Firestore
      const ratesRef = doc(db, "settings", "exchangeRates");
      await setDoc(ratesRef, newRates);

      // Log the update
      await this.logRateUpdate(newRates);

      return {
        success: true,
        data: newRates,
      };
    } catch (error) {
      console.error("Error updating exchange rates:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Log exchange rate updates for tracking
   * @param {Object} rates - The new exchange rates
   * @returns {Promise<void>}
   */
  async logRateUpdate(rates) {
    try {
      const logRef = collection(db, "exchangeRateLogs");
      await setDoc(doc(logRef), {
        ...rates,
        loggedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Error logging exchange rate update:", error);
    }
  }

  /**
   * Get exchange rate history
   * @param {number} limit - Maximum number of history entries to fetch
   * @returns {Promise<Object>} Exchange rate history
   */
  async getExchangeRateHistory(limitCount = 30) {
    try {
      const logsRef = collection(db, "exchangeRateLogs");
      const q = query(logsRef, orderBy("loggedAt", "desc"), limit(limitCount));
      const querySnapshot = await getDocs(q);

      const history = [];
      querySnapshot.forEach((doc) => {
        history.push({
          id: doc.id,
          ...doc.data(),
        });
      });

      return {
        success: true,
        data: history,
      };
    } catch (error) {
      console.error("Error fetching exchange rate history:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Convert an amount from one currency to another
   * @param {number} amount - Amount to convert
   * @param {string} fromCurrency - Source currency code
   * @param {string} toCurrency - Target currency code
   * @param {Object} rates - Exchange rates to use (optional)
   * @returns {Promise<Object>} Converted amount
   */
  async convertCurrency(amount, fromCurrency, toCurrency, rates = null) {
    try {
      if (!rates) {
        const ratesResult = await this.getExchangeRates();
        if (!ratesResult.success) {
          throw new Error(
            ratesResult.error || "Failed to fetch exchange rates"
          );
        }
        rates = ratesResult.data.rates;
      } else {
        rates = rates.rates || rates;
      }

      if (!rates[fromCurrency] || !rates[toCurrency]) {
        throw new Error("Currency not supported");
      }

      // Convert to base currency (USD) first, then to target currency
      const inUSD = amount / rates[fromCurrency];
      const convertedAmount = inUSD * rates[toCurrency];

      return {
        success: true,
        data: {
          amount: convertedAmount,
          from: fromCurrency,
          to: toCurrency,
          rate: rates[toCurrency] / rates[fromCurrency],
        },
      };
    } catch (error) {
      console.error("Error converting currency:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Add a new currency to the available currencies
   * @param {string} code - Currency code (e.g., "EUR")
   * @param {string} name - Currency name (e.g., "Euro")
   * @param {string} symbol - Currency symbol (e.g., "€")
   * @param {number} rate - Exchange rate to USD
   * @returns {Promise<Object>} Result with success status
   */
  async addCurrency(code, name, symbol, rate) {
    try {
      // Validate inputs
      code = code.toUpperCase().trim();
      if (!code || !name || !symbol || !rate) {
        throw new Error("Missing required fields");
      }

      if (isNaN(parseFloat(rate)) || parseFloat(rate) <= 0) {
        throw new Error("Rate must be a positive number");
      }

      // Get current currencies and rates
      const currenciesRef = doc(db, "settings", "currencies");
      const ratesRef = doc(db, "settings", "exchangeRates");

      const currenciesDoc = await getDoc(currenciesRef);
      const ratesDoc = await getDoc(ratesRef);

      // Update currencies
      let currencies = {};
      if (currenciesDoc.exists()) {
        currencies = currenciesDoc.data().available || {};
      }

      currencies[code] = {
        name,
        symbol,
        default: false,
      };

      await setDoc(currenciesRef, {
        available: currencies,
        updatedAt: serverTimestamp(),
      });

      // Update rates
      let ratesData = {
        base: "USD",
        rates: { USD: 1.0 },
        lastUpdated: serverTimestamp(),
      };

      if (ratesDoc.exists()) {
        ratesData = ratesDoc.data();
      }

      ratesData.rates[code] = parseFloat(rate);
      await setDoc(ratesRef, ratesData);

      return {
        success: true,
        message: `Currency ${code} added successfully`,
      };
    } catch (error) {
      console.error("Error adding currency:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Set a currency as the default
   * @param {string} code - Currency code to set as default
   * @returns {Promise<Object>} Result with success status
   */
  async setDefaultCurrency(code) {
    try {
      code = code.toUpperCase().trim();

      const currenciesRef = doc(db, "settings", "currencies");
      const currenciesDoc = await getDoc(currenciesRef);

      if (!currenciesDoc.exists()) {
        throw new Error("Currencies settings not found");
      }

      const currencies = currenciesDoc.data().available || {};

      if (!currencies[code]) {
        throw new Error(`Currency ${code} not found`);
      }

      // Remove default from current default currency
      Object.keys(currencies).forEach((key) => {
        currencies[key].default = false;
      });

      // Set new default
      currencies[code].default = true;

      await setDoc(currenciesRef, {
        available: currencies,
        updatedAt: serverTimestamp(),
      });

      return {
        success: true,
        message: `${code} set as default currency`,
      };
    } catch (error) {
      console.error("Error setting default currency:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

export default new CurrencyService();
