/**
 * Target/goal-type metrics — single source of truth for how achievement is
 * computed per goal type.
 *
 * Why this exists: GMS and ADS targets are currency-denominated (₹ target vs
 * ₹ achieved), so their achievement ratios can be summed into a meaningful
 * blended rate. ACoS targets are ratios (e.g. "keep ACoS under 20%") — they
 * are LOWER-is-better, and mixing `achieved/target` into a currency blend is
 * meaningless (a 2× ACoS over-run would read as a 200% "Elite" achievement).
 */

export const normalizeGoalType = (goalType: unknown): string =>
    String(goalType || 'GMS').toUpperCase();

/** ACoS-style goals where a smaller actual value is better. */
export const isLowerIsBetterGoal = (goalType: unknown): boolean =>
    normalizeGoalType(goalType) === 'ACOS';

/** Currency-denominated goals (GMS, ADS, …) whose ratios can be blended. */
export const isCurrencyGoal = (goalType: unknown): boolean =>
    !isLowerIsBetterGoal(goalType);

/**
 * Achievement % for ONE target.
 * Higher-is-better: achieved / target.
 * Lower-is-better (ACoS): target / actual — a 20% target with 40% actual
 * reads as 50%, not 200%.
 */
export const targetAchievementPct = (target: any): number => {
    const total = Number(target?.TotalTargetValue) || 0;
    const achieved = Number(target?.overallAchieved) || 0;
    if (isLowerIsBetterGoal(target?.GoalType)) {
        return achieved > 0 ? (total / achieved) * 100 : 0;
    }
    return total > 0 ? (achieved / total) * 100 : 0;
};

export interface BlendedAchievement {
    /** Blended achievement rate (0-100+). */
    rate: number;
    /** Sum of currency-denominated target values (0 when basis is 'mean'/'none'). */
    totalTarget: number;
    /** Sum of currency-denominated achieved values (0 when basis is 'mean'/'none'). */
    totalAchieved: number;
    /** 'currency' = value-weighted sum, 'mean' = mean of per-target pcts (ratio-only selection), 'none' = no targets. */
    basis: 'currency' | 'mean' | 'none';
}

/**
 * Blended achievement across a set of targets.
 *
 * ✅ Goal-separation fix: only currency-denominated goals (GMS/ADS) are
 * summed into the blended rate — ACoS (ratio) targets no longer pollute the
 * combined percentage. When the selection contains only ratio goals (e.g.
 * goalType = 'ACoS'), the rate is the mean of their per-target achievement.
 */
export const computeBlendedAchievement = (targets: any[]): BlendedAchievement => {
    const list = Array.isArray(targets) ? targets : [];
    const currency = list.filter((t) => isCurrencyGoal(t?.GoalType));

    if (currency.length > 0) {
        let totalTarget = 0;
        let totalAchieved = 0;
        currency.forEach((t) => {
            totalTarget += Number(t?.TotalTargetValue) || 0;
            totalAchieved += Number(t?.overallAchieved) || 0;
        });
        return {
            rate: totalTarget > 0 ? (totalAchieved / totalTarget) * 100 : 0,
            totalTarget,
            totalAchieved,
            basis: 'currency',
        };
    }

    if (list.length === 0) {
        return { rate: 0, totalTarget: 0, totalAchieved: 0, basis: 'none' };
    }

    const rate = list.reduce((sum, t) => sum + targetAchievementPct(t), 0) / list.length;
    return { rate, totalTarget: 0, totalAchieved: 0, basis: 'mean' };
};
