// src/services/recaptchaSingleton.js
import { RecaptchaVerifier } from "firebase/auth";
import { auth } from "../config/firebase";

// Create a div to host the recaptcha if it doesn't exist already
function ensureRecaptchaContainer() {
  let container = document.getElementById("recaptcha-container");

  if (!container) {
    container = document.createElement("div");
    container.id = "recaptcha-container";
    container.style.position = "fixed";
    container.style.bottom = "0";
    container.style.right = "0";
    container.style.opacity = "0.01"; // almost invisible but still functional
    container.style.zIndex = "-1"; // behind everything
    container.style.width = "300px";
    container.style.height = "100px";
    document.body.appendChild(container);
    console.log("Created recaptcha container");
  }

  return container;
}

// Global verifier instance
let verifier = null;

/**
 * Returns ONE RecaptchaVerifier for the entire lifetime of the page.
 * Call getVerifier() wherever you need to pass a RecaptchaVerifier to Firebase.
 */
export function getVerifier() {
  if (verifier) return verifier;

  // Ensure we have a container element
  ensureRecaptchaContainer();

  verifier = new RecaptchaVerifier(
    auth,
    "recaptcha-container", // the fixed ID in HTML
    { size: "invisible" }
  );

  // Render the verifier once
  verifier.render();
  console.log("reCAPTCHA verifier created and rendered");

  return verifier;
}

/**
 * Clears the previous token but keeps the iframe alive.
 * Call before every new verifyPhoneNumber() or resolver flow.
 */
export function resetVerifier() {
  try {
    if (verifier) {
      verifier.clear();
      console.log("reCAPTCHA verifier reset");
    }
  } catch (error) {
    console.warn("Error resetting reCAPTCHA verifier:", error);

    // If reset fails, create a new verifier
    if (verifier) {
      try {
        verifier.clear();
      } catch (e) {
        // Ignore clear errors
      }
      verifier = null;
    }

    // Clean up the container
    const container = document.getElementById("recaptcha-container");
    if (container) {
      container.innerHTML = "";
    }
  }
}
