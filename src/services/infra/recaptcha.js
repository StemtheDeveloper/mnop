// src/services/infra/recaptcha.js
import { RecaptchaVerifier } from "firebase/auth";
import { auth } from "../../config/firebase";

let verifier;

/**
 * Always returns the SAME verifier, already rendered.
 * The file itself never hot-reloads, so the singleton survives HMR.
 */
export function getRecaptchaVerifier() {
  if (verifier) return verifier;

  verifier = new RecaptchaVerifier(auth, "recaptcha-container", {
    size: "invisible",
  });
  verifier.render(); // <-- renders ONCE and never again
  return verifier;
}

export function resetRecaptcha() {
  // do NOT call .clear(): that removes the iframe -> error
  verifier?.reset();
}
