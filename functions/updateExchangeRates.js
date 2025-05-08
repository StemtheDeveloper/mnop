// filepath: c:\Users\GGPC\Desktop\mnop-app\functions\updateExchangeRates.js
const functions = require("firebase-functions");
const admin = require("firebase-admin");

const { onSchedule } = require("firebase-functions/v2/scheduler");

// Initialize Firebase Admin SDK if not already initialized

if (!admin.apps.length) {
  admin.initializeApp();
}

// Get Firestore instance
const db = admin.firestore();

/**
 * This function updates currency exchange rates on a daily schedule.
 * It runs every day at midnight (00:00) UTC.
 *
 * In a production environment, you would replace the simulated exchange rate updates
 * with real API calls to services like Open Exchange Rates, Fixer.io, or similar.
 */

exports.updateExchangeRates = onSchedule(
  {
    schedule: "0 0 * * *", // daily midnight UTC
    timeZone: "UTC",
  },
  async (event) => {
    try {
      console.log("Starting scheduled exchange rate update");

      // Get the current exchange rates document
      const ratesRef = admin
        .firestore()
        .collection("settings")
        .doc("exchangeRates");
      const ratesDoc = await ratesRef.get();

      if (!ratesDoc.exists) {
        console.log("Exchange rates document does not exist, creating default");
        // Create default rates if not exists
        await ratesRef.set({
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
          lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
        });
        return null;
      }

      // Get available currencies
      const currenciesRef = admin
        .firestore()
        .collection("settings")
        .doc("currencies");
      const currenciesDoc = await currenciesRef.get();

      if (!currenciesDoc.exists) {
        console.log("No currencies document found");
        return null;
      }

      const currencies = currenciesDoc.data().available || {};

      // In a real implementation, you would call an external API here
      // For this example, we'll simulate rate changes with small random variations
      // to demonstrate the functionality

      const currentRates = ratesDoc.data().rates || {};
      const newRates = { ...currentRates };

      // Apply random variations to simulate market fluctuations
      Object.keys(newRates).forEach((currency) => {
        if (currency !== "USD") {
          // USD is always 1.0 as it's our base
          // Generate a random variation between -1% and +1%
          const variation = Math.random() * 0.02 - 0.01;
          newRates[currency] =
            Math.round(newRates[currency] * (1 + variation) * 1000000) /
            1000000;
        }
      });

      // Update the rates document
      await ratesRef.update({
        rates: newRates,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Log the update in history
      await admin.firestore().collection("exchangeRateLogs").add({
        base: "USD",
        rates: newRates,
        loggedAt: admin.firestore.FieldValue.serverTimestamp(),
        source: "scheduled-update",
      });

      console.log("Exchange rates updated successfully");
      return null;
    } catch (error) {
      console.error("Error updating exchange rates:", error);
      return null;
    }
  }
);
