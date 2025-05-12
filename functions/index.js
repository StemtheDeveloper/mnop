const functions = require("firebase-functions");
const admin = require("firebase-admin");

// Initialize Firebase admin
if (!admin.apps.length) {
  admin.initializeApp();
}

// Import modules
const dailyInterestCalculation = require("./dailyInterestCalculation");
const processInvestment = require("./processInvestment");
const trendingProductExtension = require("./trendingProductExtension");
const updateMarketRates = require("./updateMarketRates");
const checkProductDeadlines = require("./checkProductDeadlines");
const distributeRevenue = require("./distributeRevenue");
const stockNotifications = require("./stockNotifications");
const updateExchangeRates = require("./updateExchangeRates");

// Export the functions
// Export v2 functions directly - ensure they maintain their v2 structure
// For v2 functions, we just re-export them as is (destructure them)
const { dailyInterestCalculationScheduled, calculateDailyInterestHttp } =
  dailyInterestCalculation;

const { processInvestment: processInvestmentFn, createInvestmentRecord } =
  processInvestment;

const { distributeInvestorRevenue } = distributeRevenue;

// Re-export v2 functions
exports.dailyInterestCalculationScheduled = dailyInterestCalculationScheduled;
exports.calculateDailyInterestHttp = calculateDailyInterestHttp;
exports.processInvestment = processInvestmentFn;
exports.createInvestmentRecord = createInvestmentRecord;
exports.distributeInvestorRevenue = distributeInvestorRevenue;

// Export other functions (gen 1 style)
// Trending product functions
exports.extendTrendingStatus = trendingProductExtension.extendTrendingStatus;
exports.checkTrendingStatus = trendingProductExtension.checkTrendingStatus;

// Market rates functions
exports.updateMarketRates = updateMarketRates.updateMarketRates;
exports.fetchLatestRates = updateMarketRates.fetchLatestRates;

// Product deadline functions
exports.checkProductDeadlines = checkProductDeadlines.checkProductDeadlines;

// Stock notification functions
exports.checkProductsBackInStock = stockNotifications.checkProductsBackInStock;
exports.notifyForBackInStock = stockNotifications.notifyForBackInStock;
exports.checkLowStockLevels = stockNotifications.checkLowStockLevels;
exports.processPurchaseOrderUpdate =
  stockNotifications.processPurchaseOrderUpdate;

// Currency exchange rate functions
exports.updateExchangeRates = updateExchangeRates.updateExchangeRates;
