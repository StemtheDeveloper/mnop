import { getFunctions, httpsCallable } from "firebase/functions";
import { initializeApp } from "firebase/app";
import { firebaseConfig } from "./src/config/firebase.js";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const functions = getFunctions();

// Get the distributeInvestorRevenue function
const distributeInvestorRevenue = httpsCallable(
  functions,
  "distributeInvestorRevenue"
);

// Test with manufacturingCost = 0
distributeInvestorRevenue({
  productId: "testProduct",
  saleAmount: 100,
  manufacturingCost: 0,
  quantity: 1,
  orderId: "test-order-" + Date.now(),
})
  .then((result) => {
    console.log("Success:", result.data);
  })
  .catch((error) => {
    console.error("Error:", error.message);
  });
