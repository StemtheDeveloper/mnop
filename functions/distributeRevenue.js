const functions = require("firebase-functions");
const admin = require("firebase-admin");

// Firebase Admin is initialized in index.js
const db = admin.firestore();

/**
 * Cloud Function to distribute revenue to investors when a product is sold
 * The function calculates each investor's share based on their investment percentage
 *
 * Required data:
 * - productId: string - ID of the product that was sold
 * - saleAmount: number - The sale amount
 * - manufacturingCost: number - Manufacturing cost per unit
 * - quantity: number - Quantity sold
 * - orderId: string - Order ID reference
 */
exports.distributeInvestorRevenue = functions.https.onCall(
  async (data, context) => {
    try {
      const { productId, saleAmount, manufacturingCost, quantity, orderId } =
        data;

      // Validate inputs
      if (
        !productId ||
        !saleAmount ||
        saleAmount <= 0 ||
        !manufacturingCost ||
        quantity <= 0
      ) {
        throw new functions.https.HttpsError(
          "invalid-argument",
          "Invalid revenue distribution parameters"
        );
      } // Calculate profit from the sale
      // Use cents for precision
      const saleAmountCents = Math.floor(saleAmount * 100);
      const manufacturingCostCents = Math.floor(manufacturingCost * 100);
      const totalManufacturingCostCents = manufacturingCostCents * quantity;
      const profitCents = Math.max(
        0,
        saleAmountCents - totalManufacturingCostCents
      );
      const profit = profitCents / 100;

      // If no profit, no distribution needed
      if (profit <= 0) {
        return {
          success: true,
          message: "No profit to distribute",
          distributedAmount: 0,
          investorCount: 0,
        };
      }

      // Get the product to check if it has investors
      const productRef = db.collection("products").doc(productId);
      const productDoc = await productRef.get();

      if (!productDoc.exists) {
        throw new functions.https.HttpsError("not-found", "Product not found");
      }

      const productData = productDoc.data();

      // Check if this is a funded product
      if (!productData.currentFunding || productData.currentFunding <= 0) {
        return {
          success: true,
          message: "Product has no investors",
          distributedAmount: 0,
          investorCount: 0,
        };
      } // Set revenue share percentage - configure as needed
      const REVENUE_SHARE_PERCENTAGE = 25; // 25% of profit goes to investors

      // Calculate revenue share with precision using the profitCents already calculated
      const totalRevenueShareCents = Math.floor(
        (profitCents * REVENUE_SHARE_PERCENTAGE) / 100
      );
      const totalRevenueShare = totalRevenueShareCents / 100;

      // Get all investments for this product
      const investmentsRef = db.collection("investments");
      const investmentsQuery = investmentsRef.where(
        "productId",
        "==",
        productId
      );
      const investmentsSnapshot = await investmentsQuery.get();

      if (investmentsSnapshot.empty) {
        return {
          success: true,
          message: "No investments found for this product",
          distributedAmount: 0,
          investorCount: 0,
        };
      }

      // Calculate each investor's share based on their percentage of total investment
      const totalInvestment = productData.currentFunding;
      const batch = db.batch();
      let totalDistributed = 0;
      let investorCount = 0; // Loop through all investments for this product
      const distributions = [];
      for (const doc of investmentsSnapshot.docs) {
        const investment = doc.data();
        const investorId = investment.userId;
        const investmentAmount = investment.amount;

        // Skip invalid investments
        if (!investorId || !investmentAmount || investmentAmount <= 0) {
          continue;
        }

        // Calculate this investor's percentage and share
        const investmentPercentage = investmentAmount / totalInvestment;

        // To ensure precise decimal calculations, convert to cents (integer math)
        // This avoids floating point errors in JavaScript
        const totalRevenueShareCents = Math.floor(totalRevenueShare * 100);
        const investmentPercentageBasis = Math.floor(
          investmentPercentage * 10000
        ); // Use basis points (0.01%)
        const revenueShareCents = Math.floor(
          (totalRevenueShareCents * investmentPercentageBasis) / 10000
        );

        // Convert cents back to dollars
        const roundedShare = revenueShareCents / 100;

        if (roundedShare <= 0) {
          continue; // Skip if share is too small
        }

        // Add to investor's wallet
        const walletRef = db.collection("wallets").doc(investorId);
        const walletDoc = await walletRef.get();

        if (walletDoc.exists) {
          batch.update(walletRef, {
            balance: admin.firestore.FieldValue.increment(roundedShare),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        } else {
          // Create a wallet if it doesn't exist
          batch.set(walletRef, {
            balance: roundedShare,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }

        // Record transaction
        const transactionRef = db.collection("transactions").doc();
        batch.set(transactionRef, {
          userId: investorId,
          amount: roundedShare,
          type: "revenue_share",
          category: "investment_return",
          description: `Revenue share from sale of ${
            productData.name || "product"
          }`,
          productId,
          orderId,
          investmentId: doc.id,
          investmentPercentage: investmentPercentage,
          saleAmount,
          profit,
          revenueSharePercentage: REVENUE_SHARE_PERCENTAGE,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          status: "completed",
        });

        // Send notification to investor
        const notificationRef = db.collection("notifications").doc();
        batch.set(notificationRef, {
          userId: investorId,
          type: "revenue_share",
          title: "Investment Revenue",
          message: `You've earned ${roundedShare.toFixed(
            2
          )} credits from sales of ${
            productData.name || "product"
          } you invested in!`,
          link: `/portfolio`,
          read: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Track distribution for return value
        distributions.push({
          investorId,
          amount: roundedShare,
          percentage: investmentPercentage,
        });

        totalDistributed += roundedShare;
        investorCount++;
      }

      // Commit all the changes as a batch
      await batch.commit();

      // Return results
      return {
        success: true,
        message: `Successfully distributed ${totalDistributed.toFixed(
          2
        )} in revenue to ${investorCount} investors`,
        distributedAmount: totalDistributed,
        investorCount,
        totalProfit: profit,
        distributions,
      };
    } catch (error) {
      console.error("Error distributing revenue:", error);
      throw new functions.https.HttpsError(
        "internal",
        error.message || "An error occurred while distributing revenue"
      );
    }
  }
);

/**
 * Helper function to distribute revenue - can be called from other functions
 */
exports.distributeRevenue = async (
  productId,
  saleAmount,
  manufacturingCost,
  quantity,
  orderId
) => {
  try {
    // Calculate profit
    // Use cents for precision
    const saleAmountCents = Math.floor(saleAmount * 100);
    const manufacturingCostCents = Math.floor(manufacturingCost * 100);
    const totalManufacturingCostCents = manufacturingCostCents * quantity;
    const profitCents = Math.max(
      0,
      saleAmountCents - totalManufacturingCostCents
    );
    const profit = profitCents / 100;

    if (profit <= 0) {
      return {
        success: true,
        message: "No profit to distribute",
        distributedAmount: 0,
      };
    }

    // Get the product
    const productRef = db.collection("products").doc(productId);
    const productDoc = await productRef.get();

    if (!productDoc.exists) {
      throw new Error("Product not found");
    }

    const productData = productDoc.data();

    // Check if this is a funded product
    if (!productData.currentFunding || productData.currentFunding <= 0) {
      return {
        success: true,
        message: "Product has no investors",
        distributedAmount: 0,
      };
    } // Set revenue share percentage
    const REVENUE_SHARE_PERCENTAGE = 25; // 25% of profit goes to investors
    // Calculate revenue share with precision using cents
    const totalRevenueShareCents = Math.floor(
      (profitCents * REVENUE_SHARE_PERCENTAGE) / 100
    );
    const totalRevenueShare = totalRevenueShareCents / 100;

    // Get all investments for this product
    const investmentsRef = db.collection("investments");
    const investmentsQuery = investmentsRef.where("productId", "==", productId);
    const investmentsSnapshot = await investmentsQuery.get();

    if (investmentsSnapshot.empty) {
      return {
        success: true,
        message: "No investments found for this product",
        distributedAmount: 0,
      };
    }

    // Calculate each investor's share
    const totalInvestment = productData.currentFunding;
    const batch = db.batch();
    let totalDistributed = 0;
    let investorCount = 0;

    // Loop through all investments
    for (const doc of investmentsSnapshot.docs) {
      const investment = doc.data();
      const investorId = investment.userId;
      const investmentAmount = investment.amount;

      // Skip invalid investments
      if (!investorId || !investmentAmount || investmentAmount <= 0) {
        continue;
      } // Calculate this investor's percentage and share
      const investmentPercentage = investmentAmount / totalInvestment;

      // To ensure precise decimal calculations, convert to cents (integer math)
      // This avoids floating point errors in JavaScript
      const totalRevenueShareCents = Math.floor(totalRevenueShare * 100);
      const investmentPercentageBasis = Math.floor(
        investmentPercentage * 10000
      ); // Use basis points (0.01%)
      const revenueShareCents = Math.floor(
        (totalRevenueShareCents * investmentPercentageBasis) / 10000
      );

      // Convert cents back to dollars
      const roundedShare = revenueShareCents / 100;

      if (roundedShare <= 0) {
        continue; // Skip if share is too small
      }

      // Add to investor's wallet
      const walletRef = db.collection("wallets").doc(investorId);
      const walletDoc = await walletRef.get();

      if (walletDoc.exists) {
        batch.update(walletRef, {
          balance: admin.firestore.FieldValue.increment(roundedShare),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      } else {
        // Create a wallet if it doesn't exist
        batch.set(walletRef, {
          balance: roundedShare,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      // Record transaction
      const transactionRef = db.collection("transactions").doc();
      batch.set(transactionRef, {
        userId: investorId,
        amount: roundedShare,
        type: "revenue_share",
        category: "investment_return",
        description: `Revenue share from sale of ${
          productData.name || "product"
        }`,
        productId,
        orderId,
        investmentId: doc.id,
        investmentPercentage: investmentPercentage,
        saleAmount,
        profit,
        revenueSharePercentage: REVENUE_SHARE_PERCENTAGE,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        status: "completed",
      });

      // Send notification to investor
      const notificationRef = db.collection("notifications").doc();
      batch.set(notificationRef, {
        userId: investorId,
        type: "revenue_share",
        title: "Investment Revenue",
        message: `You've earned ${roundedShare.toFixed(
          2
        )} credits from sales of ${
          productData.name || "product"
        } you invested in!`,
        link: `/portfolio`,
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      totalDistributed += roundedShare;
      investorCount++;
    }

    // Commit all the changes as a batch
    await batch.commit();

    // Return results
    return {
      success: true,
      message: `Successfully distributed ${totalDistributed.toFixed(
        2
      )} in revenue to ${investorCount} investors`,
      distributedAmount: totalDistributed,
      investorCount,
    };
  } catch (error) {
    console.error("Error distributing revenue:", error);
    return {
      success: false,
      error: error.message || "Failed to distribute revenue",
    };
  }
};
