// Script to update the readyForPurchase flag for a specific product
import { db } from "../config/firebase";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";

/**
 * Manually update the readyForPurchase flag for a product
 * To be used for fixing products that were funded and sent to manufacturer
 * but weren't marked as ready for purchase
 */
export const updateReadyForPurchase = async (productId) => {
  try {
    const productRef = doc(db, "products", productId);
    
    await updateDoc(productRef, {
      readyForPurchase: true,
      readyForPurchaseAt: serverTimestamp(),
    });
    
    console.log(`Successfully updated product ${productId} as ready for purchase`);
    return {
      success: true,
      message: `Product ${productId} is now marked as ready for purchase`
    };
  } catch (error) {
    console.error("Error updating product:", error);
    return {
      success: false,
      error: error.message || "Failed to update product"
    };
  }
};

// Example usage (uncomment to run):
// updateReadyForPurchase("4SFnvhrvvRLYwCquwi7B");
