const processInvestmentFunction = require("./processInvestment");
const interestCalculationFunction = require("./dailyInterestCalculation");
const marketRatesFunction = require("./updateMarketRates");
const productDeadlinesFunction = require("./checkProductDeadlines");
const trendingProductExtensionFunction = require("./trendingProductExtension");

exports.processInvestment = processInvestmentFunction.processInvestment;
exports.calculateDailyInterest =
  interestCalculationFunction.calculateDailyInterest;
exports.manuallyTriggerInterestCalculation =
  interestCalculationFunction.manuallyTriggerInterestCalculation;
exports.updateMarketRates = marketRatesFunction.updateMarketRates;
exports.manuallyUpdateMarketRates =
  marketRatesFunction.manuallyUpdateMarketRates;
exports.checkProductDeadlines = productDeadlinesFunction.checkProductDeadlines;
exports.manuallyCheckProductDeadlines =
  productDeadlinesFunction.manuallyCheckProductDeadlines;
exports.checkTrendingProducts =
  trendingProductExtensionFunction.checkTrendingProducts;
exports.requestDeadlineExtension =
  trendingProductExtensionFunction.requestDeadlineExtension;
