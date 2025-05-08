import { useEffect, useRef } from "react";
import performanceService from "../services/performanceService";

/**
 * A hook for tracking page/component performance in React components
 *
 * @param {string} componentName - Name of the component to be monitored
 * @param {object} options - Optional configuration
 * @param {boolean} options.trackMount - Whether to track component mount time (default: true)
 * @param {boolean} options.trackUnmount - Whether to track component lifecycle (default: true)
 * @param {object} options.customMetrics - Custom metrics to record on component mount
 * @returns {object} - Performance monitoring utilities
 */
const usePerformanceMonitoring = (componentName, options = {}) => {
  const {
    trackMount = true,
    trackUnmount = true,
    customMetrics = {},
  } = options;

  const traceRef = useRef(null);
  const mountTimeRef = useRef(null);

  // Start trace on component mount
  useEffect(() => {
    if (trackMount) {
      // Start a trace for this component
      mountTimeRef.current = performance.now();
      traceRef.current = performanceService.startTrace(
        `component_${componentName}`
      );

      // Record any custom metrics provided
      if (traceRef.current) {
        Object.entries(customMetrics).forEach(([key, value]) => {
          performanceService.recordMetric(traceRef.current, key, value);
        });
      }
    }

    // Stop trace on component unmount
    return () => {
      if (trackUnmount && traceRef.current) {
        // Record total mount time
        const unmountTime = performance.now();
        if (mountTimeRef.current) {
          const mountDuration = unmountTime - mountTimeRef.current;
          performanceService.recordMetric(
            traceRef.current,
            "mount_duration_ms",
            mountDuration
          );
        }

        // Record whether component unmounted properly
        performanceService.setTraceAttribute(
          traceRef.current,
          "completed_lifecycle",
          "true"
        );
        performanceService.stopTrace(traceRef.current);
      }
    };
  }, [componentName, trackMount, trackUnmount]);

  /**
   * Measure the performance of a specific user interaction
   * @param {string} actionName - Name of the action being performed
   * @param {Function} action - The function to measure
   * @returns {Promise<any>} - The result of the action
   */
  const measureUserAction = async (actionName, action) => {
    return performanceService.measureFunction(
      `${componentName}_${actionName}`,
      action
    );
  };

  /**
   * Record a custom metric for the current component trace
   * @param {string} name - Metric name
   * @param {number} value - Metric value
   */
  const recordMetric = (name, value) => {
    if (traceRef.current) {
      performanceService.recordMetric(traceRef.current, name, value);
    }
  };

  /**
   * Set a custom attribute for the current component trace
   * @param {string} name - Attribute name
   * @param {string} value - Attribute value
   */
  const setAttribute = (name, value) => {
    if (traceRef.current) {
      performanceService.setTraceAttribute(traceRef.current, name, value);
    }
  };

  return {
    measureUserAction,
    recordMetric,
    setAttribute,
  };
};

export default usePerformanceMonitoring;
