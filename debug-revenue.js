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

// Array of test cases
const testCases = [
  {
    name: "Zero manufacturing cost",
    params: {
      productId: "testProduct1",
      saleAmount: 100,
      manufacturingCost: 0,
      quantity: 1,
      orderId: "test-order-1",
    },
  },
  {
    name: "Valid manufacturing cost",
    params: {
      productId: "testProduct2",
      saleAmount: 100,
      manufacturingCost: 50,
      quantity: 1,
      orderId: "test-order-2",
    },
  },
  {
    name: "String product ID",
    params: {
      productId: "testProduct3",
      saleAmount: 100,
      manufacturingCost: 0,
      quantity: 1,
      orderId: "test-order-3",
    },
  },
  {
    name: "Number parameters",
    params: {
      productId: "testProduct4",
      saleAmount: 100.0,
      manufacturingCost: 0.0,
      quantity: 1,
      orderId: "test-order-4",
    },
  },
];

// Run tests in sequence
async function runTests() {
  console.log("Starting revenue distribution tests...");

  for (const test of testCases) {
    try {
      console.log(`Running test: ${test.name}`);
      console.log(`Parameters:`, test.params);

      const result = await distributeInvestorRevenue(test.params);
      console.log(`✅ Test passed:`, result.data);
    } catch (error) {
      console.error(`❌ Test failed:`, error.message);
      console.error(`Error code:`, error.code);
      console.error(`Error details:`, error.details);
    }
    console.log("-------------------");
  }
}

runTests();
