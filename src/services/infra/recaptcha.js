// src/services/infra/recaptcha.js
import { RecaptchaVerifier } from "firebase/auth";
import { auth } from "../../config/firebase";

let recaptchaVerifier = null;
let recaptchaWidgetId = null;

/**
 * Get or create a reCAPTCHA verifier
 * @param {string} containerOrId - DOM element or ID for reCAPTCHA container (default: 'recaptcha-container')
 * @param {boolean} invisible - Whether to use invisible reCAPTCHA (default: true)
 * @returns {RecaptchaVerifier} - reCAPTCHA verifier instance
 */
export function getRecaptchaVerifier(
  containerOrId = "recaptcha-container",
  invisible = true
) {
  if (!recaptchaVerifier) {
    try {
      recaptchaVerifier = new RecaptchaVerifier(auth, containerOrId, {
        size: invisible ? "invisible" : "normal",
        callback: () => {
          console.log("reCAPTCHA verified");
        },
        "expired-callback": () => {
          console.log("reCAPTCHA expired");
          resetRecaptcha();
        },
      });
    } catch (error) {
      console.error("Error creating reCAPTCHA verifier:", error);
      throw error;
    }
  }

  return recaptchaVerifier;
}

/**
 * Reset the reCAPTCHA verifier
 */
export function resetRecaptcha() {
  if (recaptchaVerifier) {
    try {
      recaptchaVerifier.clear();
    } catch (error) {
      console.error("Error clearing reCAPTCHA:", error);
    }
    recaptchaVerifier = null;
    recaptchaWidgetId = null;
  }

  // Clean up any reCAPTCHA iframes or divs that might be left in the DOM
  const recaptchaElements = document.querySelectorAll(
    ".grecaptcha-badge, .g-recaptcha"
  );
  recaptchaElements.forEach((element) => {
    if (element.parentNode) {
      element.parentNode.removeChild(element);
    }
  });
}

/**
 * Execute the reCAPTCHA verification
 * @returns {Promise<string>} - reCAPTCHA token
 */
export async function executeRecaptcha() {
  const verifier = getRecaptchaVerifier();

  try {
    if (!recaptchaWidgetId) {
      recaptchaWidgetId = await verifier.render();
    }

    return await verifier.verify();
  } catch (error) {
    console.error("Error executing reCAPTCHA:", error);
    resetRecaptcha();
    throw error;
  }
}

// Ensure reCAPTCHA is cleared on page unload
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", resetRecaptcha);
}
