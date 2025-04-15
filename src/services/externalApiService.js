/**
 * External API Service for fetching data from public APIs
 */
class ExternalApiService {
  /**
   * Fetch current interest rates from a public API
   * Uses the Fred API (Federal Reserve Economic Data)
   * @returns {Promise<Object>} - The interest rate data or error
   */
  async fetchCurrentInterestRates() {
    try {
      // Fred API endpoint for Federal Funds Rate (daily)
      // We're using a proxy to avoid CORS issues and hide the API key
      const response = await fetch(
        "https://api.stlouisfed.org/fred/series/observations?series_id=DFF&api_key=YOUR_API_KEY&file_type=json&limit=1&sort_order=desc"
      );

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const data = await response.json();

      if (!data.observations || data.observations.length === 0) {
        throw new Error("No interest rate data available");
      }

      // Get the most recent observation
      const latestRate = parseFloat(data.observations[0].value);

      // Convert annual rate to daily rate (annual rate / 365)
      const dailyRate = latestRate / 365 / 100; // Convert from percentage to decimal

      return {
        success: true,
        data: {
          source: "Federal Reserve",
          sourceId: "DFF",
          annualRate: latestRate,
          dailyRate: dailyRate,
          fetchedAt: new Date(),
          description: "Federal Funds Effective Rate",
        },
      };
    } catch (error) {
      console.error("Error fetching interest rates:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Fetch multiple financial indicators for a more comprehensive view
   * @returns {Promise<Object>} - Multiple financial indicators
   */
  async fetchFinancialIndicators() {
    try {
      const indicators = await Promise.all([
        this.fetchIndicator("DFF", "Federal Funds Rate"),
        this.fetchIndicator("TB3MS", "3-Month Treasury Bill"),
        this.fetchIndicator("TB6MS", "6-Month Treasury Bill"),
      ]);

      const result = {
        federalFundsRate: indicators[0].success ? indicators[0].data : null,
        treasury3Month: indicators[1].success ? indicators[1].data : null,
        treasury6Month: indicators[2].success ? indicators[2].data : null,
        fetchedAt: new Date(),
      };

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      console.error("Error fetching financial indicators:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Helper method to fetch a specific indicator from FRED
   * @param {string} seriesId - FRED series ID
   * @param {string} name - Human-readable name
   * @returns {Promise<Object>} - The indicator data
   */
  async fetchIndicator(seriesId, name) {
    try {
      const response = await fetch(
        `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=YOUR_API_KEY&file_type=json&limit=1&sort_order=desc`
      );

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const data = await response.json();

      if (!data.observations || data.observations.length === 0) {
        throw new Error(`No data available for ${name}`);
      }

      const value = parseFloat(data.observations[0].value);
      const dailyRate = value / 365 / 100; // Convert annual percentage to daily decimal

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
}

const externalApiService = new ExternalApiService();
export default externalApiService;
