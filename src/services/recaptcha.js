// src/services/recaptcha.js
import { RecaptchaVerifier } from "firebase/auth";
import { auth } from "../config/firebase";

let verifier = null;

export const getRecaptchaVerifier = () => {
  if (verifier) return verifier; // reuse across the whole app

  verifier = new RecaptchaVerifier(
    auth,
    "recaptcha-container", // **string** ID, not DOM node
    { size: "invisible" } // swap to 'normal' if you prefer
  );
  verifier.render(); // inject the <iframe> immediately
  return verifier;
};

export const resetRecaptcha = () => verifier?.reset();
export const clearRecaptcha = () => verifier?.clear();
