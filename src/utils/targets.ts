export function getAchievementTier(pct: number, isAcos = false) {
    if (isAcos) {
        if (pct <= 100) return { label: 'Track (<=100%)', color: '#059669', bg: '#d1fae5' };
        return { label: 'Over (>100%)', color: 'var(--bc-red-500)', bg: 'var(--bc-red-100)' };
    }
    if (pct >= 100) return { label: 'Elite (100%+) ', color: '#059669', bg: '#d1fae5' };
    if (pct >= 80)  return { label: 'High (80%+)  ', color: 'var(--bc-blue-600)', bg: 'var(--bc-blue-100)' };
    if (pct >= 50)  return { label: 'Track (50%+) ', color: 'var(--bc-amber-600)', bg: 'var(--bc-amber-100)' };
    return { label: 'Low (<50%)   ', color: 'var(--bc-red-500)', bg: 'var(--bc-red-100)' };
}
