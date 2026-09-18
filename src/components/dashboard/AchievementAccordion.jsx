import React from 'react';
import { AccordionApp } from '../watermelon/card-split-accordian';
import { Crown, Star, Activity, AlertTriangle } from 'lucide-react';

const TIER_ICONS = {
    elite: Crown,
    high: Star,
    ontrack: Activity,
    critical: AlertTriangle,
};

const AchievementAccordion = ({ tiers = [], total = 1 }) => {
    const items = tiers.map((t) => {
        const Icon = TIER_ICONS[t.key] || Activity;
        const pct = total > 0 ? Math.round((t.value / total) * 100) : 0;
        return {
            id: t.key,
            title: `${t.label} · ${t.value} targets`,
            icon: <Icon
                size={18}
                className="shrink-0"
                style={{ color: t.color }}
                aria-hidden="true"
            />,
            content: `${t.description}. ${pct}% of targets fall in this tier (goal threshold: ${t.range}).`,
        };
    });

    return <AccordionApp items={items} />;
};

export default AchievementAccordion;