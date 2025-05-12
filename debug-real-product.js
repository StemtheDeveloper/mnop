import { getFunctions, httpsCallable } from "firebase/functions";
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  getDocs,
  query,
  where,
  limit,
} from "firebase/firestore";
import { firebaseConfig } from "./src/config/firebase.js";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const functions = getFunctions();
const db = getFirestore();

// Get the distributeInvestorRevenue function
const distributeInvestorRevenue = httpsCallable(
  functions,
  "distributeInvestorRevenue"
);

// Get a real funded product
async function getRealFundedProduct() {
  try {
    console.log("Looking for products with investments...");
    // Query for products with investments
    const investmentsQuery = query(collection(db, "investments"), limit(1));

    const investmentsSnapshot = await getDocs(investmentsQuery);

    if (investmentsSnapshot.empty) {
      console.error("No investments found in database.");
      return null;
    }

    // Get the first investment
    const investment = investmentsSnapshot.docs[0].data();
    const productId = investment.productId;

    console.log(`Found investment for product ${productId}`);
    return productId;
  } catch (error) {
    console.error("Error fetching funded product:", error);
    return null;
  }
}

// Test revenue distribution with a real product
async function testWithRealProduct() {
  try {
    const productId = await getRealFundedProduct();

    if (!productId) {
      console.error("Could not find a product to test with.");
      return;
    }

    console.log("Testing revenue distribution with real product:", productId);

    // Test with various manufacturing cost values
    const testParams = [
      {
        name: "Zero manufacturing cost",
        params: {
          productId,
          saleAmount: 100,
          manufacturingCost: 0,
          quantity: 1,
          orderId: `real-test-1-${Date.now()}`,
        },
      },
      {
        name: "Non-zero manufacturing cost",
        params: {
          productId,
          saleAmount: 100,
          manufacturingCost: 50,
          quantity: 1,
          orderId: `real-test-2-${Date.now()}`,
        },
      },
    ];

    for (const test of testParams) {
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
  } catch (error) {
    console.error("Error in testing:", error);
  }
}

testWithRealProduct();
