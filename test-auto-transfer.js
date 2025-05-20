// Test the automatic fund transfer functionality
// This script can be run from the browser console on the product or profile page

async function testAutoTransfer() {
  try {
    // Get the wallet service
    const walletService = await import("./src/services/walletService.js").then(
      (module) => module.default
    );

    // Get product ID from the URL if on the product page
    let productId = "";

    if (window.location.pathname.includes("/product/")) {
      productId = window.location.pathname.split("/product/")[1];
    } else {
      // If not on the product page, ask for a product ID
      productId = prompt("Enter the product ID to test auto-transfer for:");
    }

    if (!productId) {
      console.error("No product ID provided");
      return;
    }

    console.log(`Testing auto-transfer for product: ${productId}`);

    // Call the auto-transfer function directly
    const result = await walletService.checkAndAutoTransferFunds(productId);

    console.log("Auto-transfer test result:", result);

    if (result.success) {
      alert(
        `Auto-transfer successful! Transferred funds to manufacturer for product ${productId}`
      );
    } else {
      alert(`Auto-transfer failed: ${result.error}`);
      console.error("Auto-transfer test failed:", result.error);
    }
  } catch (error) {
    console.error("Error testing auto-transfer:", error);
    alert(`Error testing auto-transfer: ${error.message}`);
  }
}

// Run the test
testAutoTransfer();
