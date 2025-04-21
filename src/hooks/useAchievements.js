import { useEffect, useCallback } from "react";
import { useUser } from "../context/UserContext";
import AchievementService from "../services/achievementService";
import { useToast } from "../contexts/ToastContext";  // Updated import path from context to contexts

/**
 * Hook to check and award achievements
 */
const useAchievements = () => {
  const { currentUser } = useUser();
  const { showSuccess } = useToast();

  /**
   * Check all achievements for current user
   */
  const checkAllAchievements = useCallback(async () => {
    if (!currentUser) return;

    try {
      // Check all achievement types
      const productResults = await AchievementService.checkProductAchievements(
        currentUser.uid
      );
      const investmentResults =
        await AchievementService.checkInvestmentAchievements(currentUser.uid);
      const quoteResults = await AchievementService.checkQuoteAchievements(
        currentUser.uid
      );
      const reviewResults = await AchievementService.checkReviewAchievements(
        currentUser.uid
      );
      const accountResults =
        await AchievementService.checkAccountAgeAchievements(currentUser.uid);

      // Combine all earned achievements
      const allEarnedIds = [
        ...productResults.earnedIds,
        ...investmentResults.earnedIds,
        ...quoteResults.earnedIds,
        ...reviewResults.earnedIds,
        ...accountResults.earnedIds,
      ];

      // If any achievements were earned, show a notification
      if (allEarnedIds.length > 0) {
        const message =
          allEarnedIds.length === 1
            ? "You earned a new achievement!"
            : `You earned ${allEarnedIds.length} new achievements!`;

        showSuccess(message);
      }

      return { earnedIds: allEarnedIds };
    } catch (error) {
      console.error("Error checking achievements:", error);
      return { earnedIds: [] };
    }
  }, [currentUser, showSuccess]);

  /**
   * Check product achievements
   */
  const checkProductAchievements = useCallback(async () => {
    if (!currentUser) return { earnedIds: [] };

    const results = await AchievementService.checkProductAchievements(
      currentUser.uid
    );

    if (results.earnedIds.length > 0) {
      showSuccess("You earned a product achievement!");
    }

    return results;
  }, [currentUser, showSuccess]);

  /**
   * Check investment achievements
   */
  const checkInvestmentAchievements = useCallback(async () => {
    if (!currentUser) return { earnedIds: [] };

    const results = await AchievementService.checkInvestmentAchievements(
      currentUser.uid
    );

    if (results.earnedIds.length > 0) {
      showSuccess("You earned an investment achievement!");
    }

    return results;
  }, [currentUser, showSuccess]);

  /**
   * Check quote achievements
   */
  const checkQuoteAchievements = useCallback(async () => {
    if (!currentUser) return { earnedIds: [] };

    const results = await AchievementService.checkQuoteAchievements(
      currentUser.uid
    );

    if (results.earnedIds.length > 0) {
      showSuccess("You earned a manufacturing achievement!");
    }

    return results;
  }, [currentUser, showSuccess]);

  /**
   * Check review achievements
   */
  const checkReviewAchievements = useCallback(async () => {
    if (!currentUser) return { earnedIds: [] };

    const results = await AchievementService.checkReviewAchievements(
      currentUser.uid
    );

    if (results.earnedIds.length > 0) {
      showSuccess("You earned a reviewer achievement!");
    }

    return results;
  }, [currentUser, showSuccess]);

  // Check all achievements on first load
  useEffect(() => {
    if (currentUser) {
      setTimeout(() => {
        checkAllAchievements();
      }, 2000); // Slight delay to avoid overloading on initial load
    }
  }, [currentUser, checkAllAchievements]);

  return {
    checkAllAchievements,
    checkProductAchievements,
    checkInvestmentAchievements,
    checkQuoteAchievements,
    checkReviewAchievements,
  };
};

export default useAchievements;
