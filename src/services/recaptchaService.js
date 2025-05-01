// src/services/recaptchaService.js
import { RecaptchaVerifier } from "firebase/auth";
import { auth } from "../config/firebase";

/**
 * A service to handle reCAPTCHA verification in a reliable way
 */
class RecaptchaService {
  constructor() {
    this._verifier = null;
    this._containerId = null;
    this._isRendered = false;
    this._pendingOperation = null;
  }

  /**
   * Get or create a reCAPTCHA verifier instance
   * @param {string} containerId - DOM element ID for the reCAPTCHA container
   * @returns {RecaptchaVerifier} - The reCAPTCHA verifier instance
   */
  getVerifier(containerId = "recaptcha-container") {
    // If we have a pending operation, wait for it to finish
    if (this._pendingOperation) {
      console.log("Waiting for pending reCAPTCHA operation to complete...");
      return this._pendingOperation.then(() => this.getVerifier(containerId));
    }

    // If we already have a verifier for this container, return it
    if (
      this._verifier &&
      this._containerId === containerId &&
      this._isRendered
    ) {
      return this._verifier;
    }

    // Clean up any existing instance
    this.cleanup();

    // Create a promise for this operation
    this._pendingOperation = new Promise((resolve, reject) => {
      try {
        // Ensure the container exists
        let container = document.getElementById(containerId);
        if (!container) {
          // Create a fallback container at the body level
          container = document.createElement("div");
          container.id = containerId;
          container.style.position = "fixed";
          container.style.bottom = "0";
          container.style.right = "0";
          container.style.opacity = "0.01"; // almost invisible but still functional
          container.style.zIndex = "-1"; // behind everything
          container.style.width = "300px";
          container.style.height = "100px";
          document.body.appendChild(container);
          console.log("Created fallback recaptcha container:", containerId);
        }

        // Make sure it's empty
        container.innerHTML = "";

        // Create new verifier with delays to allow proper DOM rendering
        setTimeout(() => {
          try {
            this._verifier = new RecaptchaVerifier(auth, containerId, {
              size: "invisible",
              callback: () => {
                console.log("reCAPTCHA verified");
              },
              "expired-callback": () => {
                console.log("reCAPTCHA expired");
                this._isRendered = false;
              },
            });

            // Store the container ID
            this._containerId = containerId;

            // Render immediately
            this._verifier
              .render()
              .then(() => {
                console.log("reCAPTCHA rendered successfully");
                this._isRendered = true;
                this._pendingOperation = null;
                resolve(this._verifier);
              })
              .catch((error) => {
                console.error("reCAPTCHA render failed:", error);
                this._isRendered = false;
                this._pendingOperation = null;
                this.cleanup();
                reject(error);
              });
          } catch (innerError) {
            console.error("Error creating reCAPTCHA verifier:", innerError);
            this._pendingOperation = null;
            this.cleanup();
            reject(innerError);
          }
        }, 100); // Small delay to let the DOM update
      } catch (outerError) {
        console.error("Error initializing recaptcha service:", outerError);
        this._isRendered = false;
        this._pendingOperation = null;
        reject(outerError);
      }
    });

    return this._pendingOperation;
  }

  /**
   * Clean up the current verifier
   */
  cleanup() {
    try {
      if (this._verifier) {
        // Try to clear the verifier
        try {
          if (typeof this._verifier.clear === "function") {
            this._verifier.clear();
          }
        } catch (clearError) {
          console.warn("Error clearing reCAPTCHA:", clearError);
        }

        // Remove from DOM if possible
        if (this._containerId) {
          const container = document.getElementById(this._containerId);
          if (container) {
            container.innerHTML = "";
          }
        }

        this._verifier = null;
      }
      this._isRendered = false;
      this._containerId = null;
    } catch (error) {
      console.warn("Error cleaning up recaptcha verifier:", error);
    }
  }

  /**
   * Reset the current verifier if it exists
   * If reset fails, clean up completely to ensure a fresh instance next time
   */
  reset() {
    try {
      if (this._verifier) {
        // Check if we're dealing with a proper RecaptchaVerifier
        if (this._verifier instanceof RecaptchaVerifier) {
          // Try to use the reset method if available
          if (typeof this._verifier.reset === "function") {
            this._verifier.reset();
            return;
          }
        }
        // If we can't reset, clean up and let a new instance be created next time
        console.log("Reset not available, cleaning up reCAPTCHA for next use");
      }
      // Always clean up to be safe
      this.cleanup();
    } catch (error) {
      console.error(
        "Error resetting recaptcha verifier, will recreate next time:",
        error
      );
      // If reset fails, clean up and recreate on next use
      this.cleanup();
    }
  }
}

// Create a singleton instance
const recaptchaService = new RecaptchaService();

export default recaptchaService;
