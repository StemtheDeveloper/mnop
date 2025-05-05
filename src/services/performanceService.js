import { perf, trace } from "../config/firebase";

/**
 * Performance Monitoring Service
 * Provides utilities for tracking performance metrics throughout the application
 */
class PerformanceService {
  /**
   * Start a custom trace to measure a specific operation
   * @param {string} traceName - The name of the trace
   * @returns {object} - The trace object
   */
  startTrace(traceName) {
    try {
      if (!perf) return null;

      const currentTrace = trace(perf, traceName);
      currentTrace.start();
      return currentTrace;
    } catch (error) {
      console.error(`Error starting performance trace ${traceName}:`, error);
      return null;
    }
  }

  /**
   * Stop a trace and record its performance data
   * @param {object} traceObj - The trace object returned by startTrace
   */
  stopTrace(traceObj) {
    try {
      if (!traceObj) return;

      traceObj.stop();
    } catch (error) {
      console.error("Error stopping performance trace:", error);
    }
  }

  /**
   * Record a performance metric for a specific trace
   * @param {object} traceObj - The trace object
   * @param {string} metricName - The name of the metric
   * @param {number} value - The value to record
   */
  recordMetric(traceObj, metricName, value) {
    try {
      if (!traceObj) return;

      traceObj.putMetric(metricName, value);
    } catch (error) {
      console.error(`Error recording metric ${metricName}:`, error);
    }
  }

  /**
   * Add a custom attribute to a trace
   * @param {object} traceObj - The trace object
   * @param {string} attributeName - The attribute name
   * @param {string} value - The attribute value
   */
  setTraceAttribute(traceObj, attributeName, value) {
    try {
      if (!traceObj) return;

      traceObj.putAttribute(attributeName, String(value));
    } catch (error) {
      console.error(`Error setting trace attribute ${attributeName}:`, error);
    }
  }

  /**
   * Measure the performance of a function with a trace
   * @param {string} traceName - The name of the trace
   * @param {Function} fn - The function to measure
   * @param {Array} args - Arguments to pass to the function
   * @returns {any} - The result of the function
   */
  async measureFunction(traceName, fn, ...args) {
    const traceObj = this.startTrace(traceName);

    try {
      const result = await fn(...args);
      return result;
    } finally {
      this.stopTrace(traceObj);
    }
  }

  /**
   * Create a higher-order function that measures performance
   * @param {string} traceName - The name of the trace
   * @param {Function} fn - The function to wrap
   * @returns {Function} - The wrapped function
   */
  traceFunction(traceName, fn) {
    return async (...args) => {
      return this.measureFunction(traceName, fn, ...args);
    };
  }
}

export default new PerformanceService();
