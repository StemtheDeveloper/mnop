const functions = require("firebase-functions");
const admin = require("firebase-admin");

// Initialize Firebase admin
if (!admin.apps.length) {
  admin.initializeApp();
}

const dailyInterestCalculation = require("./dailyInterestCalculation");
const processInvestment = require("./processInvestment");
const trendingProductExtension = require("./trendingProductExtension");
const updateMarketRates = require("./updateMarketRates");
const checkProductDeadlines = require("./checkProductDeadlines");
const distributeRevenue = require("./distributeRevenue");
const stockNotifications = require("./stockNotifications");
const updateExchangeRates = require("./updateExchangeRates");

// Export the functions
// Daily interest calculation functions
exports.dailyInterestCalculationScheduled =
  dailyInterestCalculation.dailyInterestCalculationScheduled;
exports.calculateDailyInterestHttp =
  dailyInterestCalculation.calculateDailyInterestHttp;

// Export other functions
// Process investment functions
exports.processInvestment = processInvestment.processInvestment;
exports.createInvestmentRecord = processInvestment.createInvestmentRecord;

// Trending product functions
exports.extendTrendingStatus = trendingProductExtension.extendTrendingStatus;
exports.checkTrendingStatus = trendingProductExtension.checkTrendingStatus;

// Market rates functions
exports.updateMarketRates = updateMarketRates.updateMarketRates;
exports.fetchLatestRates = updateMarketRates.fetchLatestRates;

// Product deadline functions
exports.checkProductDeadlines = checkProductDeadlines.checkProductDeadlines;

// Revenue distribution functions
exports.distributeInvestorRevenue = distributeRevenue.distributeInvestorRevenue;

// Stock notification functions
exports.checkProductsBackInStock = stockNotifications.checkProductsBackInStock;
exports.notifyForBackInStock = stockNotifications.notifyForBackInStock;
exports.checkLowStockLevels = stockNotifications.checkLowStockLevels;
exports.processPurchaseOrderUpdate =
  stockNotifications.processPurchaseOrderUpdate;

// Currency exchange rate functions
exports.updateExchangeRates = updateExchangeRates.updateExchangeRates;
