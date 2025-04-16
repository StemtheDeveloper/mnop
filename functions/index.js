const functions = require("firebase-functions");
const dailyInterestCalculation = require("./dailyInterestCalculation");
const processInvestment = require("./processInvestment");
const trendingProductExtension = require("./trendingProductExtension");
const updateMarketRates = require("./updateMarketRates");
const checkProductDeadlines = require("./checkProductDeadlines");

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
