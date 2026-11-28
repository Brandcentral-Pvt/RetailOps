import { fmtINR, fmtPct, pctDelta, pointDelta } from './primitives';

/**
 * Rule-based insights computed from the dashboard payload. Every insight is
 * derived from data that is actually present — when a comparison has no
 * prior value, the rule simply does not fire (no fabricated 0% changes).
 *
 * Each insight: { id, tone: 'pos'|'neg'|'warn'|'info', text, target }
 * where `target` is the DOM id of the panel to scroll to.
 */

const signed = (v, digits = 1) => `${v > 0 ? '▲' : v < 0 ? '▼' : '■'} ${Math.abs(v).toFixed(digits)}%`;
const shortTitle = (t, n = 34) => {
    const s = String(t || '').trim();
    return s.length > n ? `${s.slice(0, n - 1)}…` : s;
};

export function buildInsights({ dashboardRaw, portfolio,taskSummary, products = [], targets = [], tasks = [], pipeline = [], now = Date.now() }) {
    const out = [];
    const raw = dashboardRaw || {};
    const gms = raw.gms;
    const prev = raw.previous;
    const days = raw.period?.days;
    const vs = days ? `vs previous ${days}d` : 'vs previous period';

    // ── GMS momentum ─────────────────────────────────────────────────
    if (gms && gms.revenue > 0 && gms.deltaPct !== null && gms.deltaPct !== undefined) {
        const d = Number(gms.deltaPct);
        out.push({
            id: 'gms-delta',
            tone: d >= 0 ? 'pos' : (d <= -10 ? 'neg' : 'warn'),
            text: `GMS ${fmtINR(gms.revenue)} · ${signed(d)} ${vs}`,
            target: 'ops-trend',
            priority: Math.abs(d) >= 10 ? 1 : 3,
        });
    }

    // ── TACoS drift (ad spend relative to merchandise sales) ─────────
    if (gms?.tacos!=null&&raw.ads?.comparison?.ratios?.tacos!=null) {
        const pts=raw.ads.comparison.ratios.tacos;
        if (pts !== null && Math.abs(pts) >= 0.5) {
            out.push({
                id: 'tacos',
                tone: pts > 0 ? (pts >= 2 ? 'neg' : 'warn') : 'pos',
                text: `TACoS ${fmtPct(gms.tacos)} · ${pts > 0 ? '▲' : '▼'} ${Math.abs(pts).toFixed(1)} pts ${vs}`,
                target: 'ops-trend',
                priority: pts >= 2 ? 1 : 2,
            });
        }
    }

    // ── Movers (need a real prior value) ─────────────────────────────
    const withPrev = products.filter(p=>p.gmsRevenue!=null&&p.deltaPct!=null&&Number(p.prevGmsRevenue)>0);
    if (withPrev.length > 0) {
        const byAbs = [...withPrev].sort((a, b) => (b.gmsRevenue - b.prevGmsRevenue) - (a.gmsRevenue - a.prevGmsRevenue));
        const gainer = byAbs[0];
        const decliner = byAbs[byAbs.length - 1];
        if (gainer && gainer.gmsRevenue - gainer.prevGmsRevenue > 0) {
            out.push({
                id: 'gainer',
                tone: 'pos',
                text: `Leading displayed gainer ${gainer.asin} · +${fmtINR(gainer.gmsRevenue - gainer.prevGmsRevenue)} (${signed(pctDelta(gainer.gmsRevenue, gainer.prevGmsRevenue))}) — ${shortTitle(gainer.title)}`,
                target: 'ops-top-products',
                priority: 3,
            });
        }
        if (decliner && decliner !== gainer && decliner.gmsRevenue - decliner.prevGmsRevenue < 0) {
            const drop = pctDelta(decliner.gmsRevenue, decliner.prevGmsRevenue);
            out.push({
                id: 'decliner',
                tone: drop <= -30 ? 'neg' : 'warn',
                text: `Leading displayed decline ${decliner.asin} · −${fmtINR(decliner.prevGmsRevenue - decliner.gmsRevenue)} (${signed(drop)}) — ${shortTitle(decliner.title)}`,
                target: 'ops-top-products',
                priority: drop <= -30 ? 1 : 2,
            });
        }
    }

    // Concentration uses the complete mapped positive-revenue population.
    if(portfolio?.status==='observed_complete'&&portfolio.positiveProducts>=3&&portfolio.top3RevenueShare>=40){
        const share=portfolio.top3RevenueShare;
        out.push({id:'concentration',tone:share>=60?'warn':'info',text:`Top three seller-ASINs hold ${fmtPct(share,0)} of positive mapped revenue`,target:'ops-portfolio',priority:share>=60?2:4});
    }

    // ── Unadvertised leaders ─────────────────────────────────────────
    const leaders = products.slice(0, 25);
    const unadvertised = leaders.filter((p) => Number(p.gmsRevenue)>0&&p.adSpend!=null&&Number(p.adSpend)===0&&p.adsCoverage?.AdSpend?.status==='complete');
    if (leaders.length >= 5 && unadvertised.length > 0 && raw.ads && Number(raw.ads.adSpend) > 0) {
        out.push({
            id: 'unadvertised',
            tone: 'info',
            text: `${unadvertised.length} of the top ${leaders.length} ASINs had no ad spend this period`,
            target: 'ops-top-products',
            priority: 4,
        });
    }

    // ── Brand momentum ───────────────────────────────────────────────
    const sellers = Array.isArray(raw.gmsBySeller) ? raw.gmsBySeller : [];
    if (sellers.length > 1) {
        const lead = sellers[0];
        if (lead && lead.revenue > 0) {
            out.push({
                id: 'brand-lead',
                tone: 'info',
                text: `${lead.sellerName} leads GMS with ${fmtINR(lead.revenue)} (${fmtPct(lead.share, 0)} share)`,
                target: 'ops-brands',
                priority: 4,
            });
        }
        const falling = sellers
            .filter((s) => s.prevRevenue > 0 && s.deltaPct !== null && s.deltaPct <= -15)
            .sort((a, b) => (a.revenue - a.prevRevenue) - (b.revenue - b.prevRevenue))[0];
        if (falling) {
            out.push({
                id: 'brand-fall',
                tone: 'warn',
                text: `${falling.sellerName} GMS ${signed(falling.deltaPct)} ${vs}`,
                target: 'ops-brands',
                priority: 2,
            });
        }
    }

    // ── Catalog health ───────────────────────────────────────────────
    const stats = raw.stats || {};
    const oos = Number(stats.outOfStockAsins) || 0;
    const active = Number(stats.activeAsins) || 0;
    if (oos > 0) {
        const share = active > 0 ? (oos / active) * 100 : 0;
        out.push({
            id: 'oos',
            tone: share >= 10 ? 'neg' : 'warn',
            text: `${oos} active ASIN${oos === 1 ? '' : 's'} out of stock${active > 0 ? ` (${fmtPct(share, 0)} of active)` : ''}`,
            target: 'ops-catalog',
            priority: share >= 10 ? 1 : 2,
        });
    }

    // ── Targets at risk ──────────────────────────────────────────────
    if (targets.length > 0) {
        const atRisk=targets.filter(t=>['below_target','over_limit'].includes(t.status)).length;
        if (atRisk > 0) {
            out.push({
                id: 'targets',
                tone: atRisk / targets.length >= 0.5 ? 'neg' : 'warn',
                text: `${atRisk} of ${targets.length} target${targets.length === 1 ? '' : 's'} below closed revenue target or above spending/ACoS limit`,
                target: 'ops-goals',
                priority: 2,
            });
        }
    }

    // ── Overdue tasks ────────────────────────────────────────────────
    const overdue=taskSummary?.overdue??0;
    if (overdue > 0) {
        out.push({
            id: 'overdue',
            tone: 'warn',
            text: `${overdue} workspace task${overdue === 1 ? '' : 's'} overdue`,
            target: 'ops-tasks',
            priority: 2,
        });
    }

    // ── Sync failures ────────────────────────────────────────────────
    const failed = pipeline.filter((t) => String(t.status || '').toUpperCase() === 'FAILED').length;
    if (failed > 0) {
        out.push({
            id: 'sync-failed',
            tone: 'neg',
            text: `${failed} sync run${failed === 1 ? '' : 's'} failed`,
            target: 'ops-pipeline',
            priority: 1,
        });
    }

    const toneRank = { neg: 0, warn: 1, pos: 2, info: 3 };
    return out
        .sort((a, b) => (a.priority - b.priority) || (toneRank[a.tone] - toneRank[b.tone]))
        .slice(0, 6);
}
