const functions = require("firebase-functions");
const admin = require("firebase-admin");
const fetch = require("node-fetch");

/**
 * Cloud Function to update interest rates based on market data
 * Runs once per day to ensure rates are current
 */
exports.updateMarketRates = functions.pubsub
  .schedule("0 12 * * *") // Run at noon UTC every day
  .timeZone("UTC")
  .onRun(async (context) => {
    console.log("Starting daily market rate update...");

    try {
      // Check if we need to update rates based on current settings
      const db = admin.firestore();
      const settingsRef = db.collection("systemSettings").doc("interestRates");
      const settingsDoc = await settingsRef.get();

      if (!settingsDoc.exists) {
        console.log("Interest rate settings not found, creating default...");
        // Create default settings
        await settingsRef.set({
          dailyRate: 0.0001, // 0.01% daily (≈ 3.65% annual)
          minBalance: 100,
          useMarketRate: true,
          manualRateOffset: 0.5, // 0.5% above treasury rate
          lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      const settings = settingsDoc.exists
        ? settingsDoc.data()
        : {
            useMarketRate: true,
            manualRateOffset: 0.5,
          };

      // Only proceed if we're using market rates
      if (!settings.useMarketRate) {
        console.log("Market rate update skipped - using manual rates");
        return null;
      }

      // Fetch market rates
      const rates = await fetchFinancialIndicators();

      // Calculate new daily rate based on 3-Month Treasury
      let newDailyRate = settings.dailyRate; // Default to current rate
      let marketData = null;

      if (rates.treasury3Month) {
        // Use treasury rate as base, add offset, then convert to daily rate
        const baseSpread = 0.5;
        const offsetPercentage = settings.manualRateOffset || 0;
        const annualRate =
          rates.treasury3Month.value + baseSpread + offsetPercentage;
        newDailyRate = annualRate / 365 / 100; // Convert to daily decimal rate
        marketData = {
          federalFundsRate: rates.federalFundsRate?.value || null,
          treasury3Month: rates.treasury3Month.value,
          treasury6Month: rates.treasury6Month?.value || null,
          fetchedAt: new Date(),
        };
      }

      // Update Firestore
      await settingsRef.update({
        dailyRate: newDailyRate,
        marketData,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log("Market rates updated successfully:", {
        dailyRate: newDailyRate,
        annualEquivalent: newDailyRate * 365 * 100,
      });

      // Create a record in system logs
      await db.collection("systemLogs").add({
        type: "marketRateUpdate",
        dailyRate: newDailyRate,
        marketData,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });

      return null;
    } catch (error) {
      console.error("Error updating market rates:", error);
      throw error;
    }
  });

/**
 * HTTP callable function to manually trigger a market rate update
 */
exports.manuallyUpdateMarketRates = functions.https.onCall(
  async (data, context) => {
    // Check if the user is authenticated and has admin role
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "You must be signed in to update market rates"
      );
    }

    try {
      const db = admin.firestore();

      // Check if user is an admin
      const userRef = db.collection("users").doc(context.auth.uid);
      const userDoc = await userRef.get();

      if (!userDoc.exists) {
        throw new functions.https.HttpsError("not-found", "User not found");
      }

      const userData = userDoc.data();
      const roles = userData.roles || [];

      // Verify admin role
      if (!Array.isArray(roles) || !roles.includes("admin")) {
        throw new functions.https.HttpsError(
          "permission-denied",
          "You must be an admin to update market rates"
        );
      }

      // Fetch market rates
      const rates = await fetchFinancialIndicators();

      // Get current settings
      const settingsRef = db.collection("systemSettings").doc("interestRates");
      const settingsDoc = await settingsRef.get();

      if (!settingsDoc.exists) {
        throw new functions.https.HttpsError(
          "not-found",
          "Interest rate settings not found"
        );
      }

      const settings = settingsDoc.data();

      // Calculate new daily rate
      let newDailyRate = settings.dailyRate;
      const useMarketRate =
        data?.useMarketRate !== undefined
          ? data.useMarketRate
          : settings.useMarketRate;
      const manualRateOffset =
        data?.manualRateOffset !== undefined
          ? data.manualRateOffset
          : settings.manualRateOffset || 0;

      const marketData = {
        federalFundsRate: rates.federalFundsRate?.value || null,
        treasury3Month: rates.treasury3Month?.value || null,
        treasury6Month: rates.treasury6Month?.value || null,
        fetchedAt: new Date(),
      };

      if (useMarketRate && rates.treasury3Month) {
        const baseSpread = 0.5;
        const annualRate =
          rates.treasury3Month.value + baseSpread + manualRateOffset;
        newDailyRate = annualRate / 365 / 100;
      }

      // Update Firestore
      await settingsRef.update({
        dailyRate: newDailyRate,
        useMarketRate,
        manualRateOffset,
        marketData,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Log the operation
      await db.collection("systemLogs").add({
        type: "manualMarketRateUpdate",
        adminId: context.auth.uid,
        dailyRate: newDailyRate,
        useMarketRate,
        manualRateOffset,
        marketData,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });

      return {
        success: true,
        data: {
          dailyRate: newDailyRate,
          annualEquivalent: newDailyRate * 365 * 100,
          marketData,
        },
      };
    } catch (error) {
      console.error("Error in manual market rate update:", error);
      throw new functions.https.HttpsError("internal", error.message);
    }
  }
);

/**
 * Helper function to fetch financial indicators from FRED API
 */
async function fetchFinancialIndicators() {
  try {
    // Fetch multiple indicators in parallel
    const [federalFundsRate, treasury3Month, treasury6Month] =
      await Promise.all([
        fetchIndicator("DFF", "Federal Funds Rate"),
        fetchIndicator("TB3MS", "3-Month Treasury Bill"),
        fetchIndicator("TB6MS", "6-Month Treasury Bill"),
      ]);

    return {
      federalFundsRate: federalFundsRate.success ? federalFundsRate.data : null,
      treasury3Month: treasury3Month.success ? treasury3Month.data : null,
      treasury6Month: treasury6Month.success ? treasury6Month.data : null,
    };
  } catch (error) {
    console.error("Error fetching financial indicators:", error);
    throw error;
  }
}

/**
 * Helper function to fetch a specific indicator from FRED API
 */
async function fetchIndicator(seriesId, name) {
  try {
    // For cloud functions, we can use an API key directly
    const API_KEY = functions.config().fred.api_key || "YOUR_API_KEY";

    const response = await fetch(
      `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}` +
        `&api_key=${API_KEY}&file_type=json&limit=1&sort_order=desc`
    );

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();

    if (!data.observations || data.observations.length === 0) {
      throw new Error(`No data available for ${name}`);
    }

    const value = parseFloat(data.observations[0].value);
    const dailyRate = value / 365 / 100;

    return {
      success: true,
      data: {
        name,
        value,
        dailyRate,
        date: data.observations[0].date,
      },
    };
  } catch (error) {
    console.error(`Error fetching ${name}:`, error);
    return {
      success: false,
      error: error.message,
    };
  }
}
