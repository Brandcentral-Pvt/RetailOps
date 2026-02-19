const mongoose = require('mongoose');
const Asin = require('../models/Asin');
const { ReferralFee, ClosingFee, ShippingFee, StorageFee, CategoryMap, NodeMap, RefundFee } = require('../models/Fee');

// Helper to calculate match score for fuzzy category matching
const calculateMatchScore = (ruleCat, itemPath) => {
    try {
        const clean = (s) => s.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
        const stopWords = ['and', 'for', 'the', 'products', 'other', 'supplies', 'accessories'];
        const ruleTokens = clean(ruleCat).split(/\s+/).filter(t => t.length > 2 && !stopWords.includes(t));
        const pathTokens = clean(itemPath).split(/\s+/);

        if (ruleTokens.length === 0) return 0;

        let matches = 0;
        for (const token of ruleTokens) {
            if (pathTokens.some(pt => pt === token)) {
                matches += 1;
            } else if (pathTokens.some(pt => pt.includes(token) || token.includes(pt))) {
                matches += 0.8;
            }
        }
        return matches / ruleTokens.length;
    } catch (error) {
        console.error('Error calculating match score:', error);
        return 0;
    }
};

// Helper to calculate return fee
const calculateReturnFee = (price, stepLevel, category, refundFees) => {
    try {
        if (!price || price <= 0 || !refundFees || refundFees.length === 0) return 0;

        const priceRange = refundFees.find(rf => price >= rf.minPrice && price <= rf.maxPrice);
        if (!priceRange) return 0;

        const cat = (category || '').toLowerCase();
        let feeCategory = 'General';
        if (cat.includes('shoes') || cat.includes('footwear')) {
            feeCategory = 'Shoes';
        } else if (cat.includes('apparel') || cat.includes('clothing')) {
            feeCategory = 'Apparel';
        }

        const applicableFee = refundFees.find(rf =>
            rf.category === feeCategory &&
            price >= rf.minPrice && price <= rf.maxPrice
        );

        if (!applicableFee) return 0;

        switch (stepLevel) {
            case 'Basic': return applicableFee.basic || 0;
            case 'Standard': return applicableFee.standard || 0;
            case 'Advanced': return applicableFee.advanced || 0;
            case 'Premium': return applicableFee.premium || 0;
            default: return applicableFee.standard || 0;
        }
    } catch (error) {
        console.error('Error calculating return fee:', error);
        return 0;
    }
};

const calculateProfits = async (asinIds = []) => {
    try {
        console.log(`[FeeCalc] Starting calculation for ${asinIds.length} items`);

        const [referralFees, closingFees, shippingFees, storageFees, categoryMappings, nodeMaps, refundFees] = await Promise.all([
            ReferralFee.find(),
            ClosingFee.find(),
            ShippingFee.find(),
            StorageFee.find(),
            CategoryMap.find(),
            NodeMap.find(),
            RefundFee.find()
        ]);

        const GST_RATE = 0.18;

        const query = asinIds.length > 0 ? { _id: { $in: asinIds } } : { status: { $in: ['Active', 'Pending'] } };
        const items = await Asin.find(query);

        for (const item of items) {
            // Logic mirrors engine.ts from Calculator
            const price = Number(item.currentPrice || item.buyBoxPrice) || 0;
            const weight = Number(item.weight) || 0;

            if (price <= 0) {
                continue; // Skip invalid price
            }

            // 1. Referral Fees logic
            let refRule = undefined;
            // Using category instead of nodeId for now as Asin model stores category string
            const itemCat = (item.category || '').toLowerCase();

            // NodeMap logic would go here if we had nodeId on Asin model (we only store category string)
            // Category Mapping
            if (!refRule) {
                const mapping = categoryMappings.find(m => itemCat.includes(m.keepaCategory.toLowerCase()));
                if (mapping) {
                    refRule = referralFees.find(r => r.category.toLowerCase() === mapping.feeCategory.toLowerCase());
                }
            }

            // Direct/Fuzzy Match
            if (!refRule) {
                refRule = referralFees.find(r => r.category.toLowerCase() === itemCat);
                if (!refRule) {
                    let bestScore = 0; let bestRule = null;
                    for (const r of referralFees) {
                        const score = calculateMatchScore(r.category, itemCat);
                        if (score > bestScore) { bestScore = score; bestRule = r; }
                    }
                    if (bestScore >= 0.4) refRule = bestRule;
                }
            }

            // Fallbacks
            if (!refRule) {
                if (itemCat.includes('book')) refRule = referralFees.find(r => r.category === 'Books');
            }

            let referralFee = 0;
            if (refRule && refRule.tiers) {
                const sorted = [...refRule.tiers].sort((a, b) => a.minPrice - b.minPrice);
                const tier = sorted.find(t => price >= t.minPrice && price <= t.maxPrice);
                if (tier) referralFee = Number((price * (tier.percentage / 100)).toFixed(2));
                else {
                    const last = sorted[sorted.length - 1];
                    if (last && price > last.maxPrice) referralFee = Number((price * (last.percentage / 100)).toFixed(2));
                }
            }

            // 2. Closing Fees
            let closingFee = 0;
            let matchedClosing = undefined;

            const findBestMatch = (candidates, priceVal) => {
                if (!candidates || candidates.length === 0) return undefined;
                // Prefer FC
                const fc = candidates.filter(c => c.sellerType === 'FC');
                const pool = fc.length > 0 ? fc : candidates;
                return pool.find(c => priceVal >= c.minPrice && priceVal <= c.maxPrice) || pool[pool.length - 1];
            };

            // Mappings/Direct match similar to Referral
            if (!matchedClosing) {
                const mapping = categoryMappings.find(m => itemCat.includes(m.keepaCategory.toLowerCase()));
                if (mapping) {
                    const candidates = closingFees.filter(c => c.category && c.category.toLowerCase() === mapping.feeCategory.toLowerCase());
                    matchedClosing = findBestMatch(candidates, price);
                }
            }

            if (!matchedClosing) {
                const candidates = closingFees.filter(c => c.category && c.category.toLowerCase() === itemCat);
                matchedClosing = findBestMatch(candidates, price);
            }

            // Price tier fallback
            if (!matchedClosing) {
                matchedClosing = findBestMatch(closingFees, price);
            }

            if (matchedClosing) closingFee = matchedClosing.fee;
            if (!matchedClosing && price > 1000) closingFee = 51; // Fallback

            // 3. Shipping
            const sizeType = item.stapleLevel || 'Standard';
            const normSize = sizeType.charAt(0).toUpperCase() + sizeType.slice(1).toLowerCase();
            const relevantFees = shippingFees
                .filter(f => f.sizeType.toLowerCase() === normSize.toLowerCase())
                .sort((a, b) => a.weightMin - b.weightMin);

            let weightFee = 0;
            let pickPack = 0;

            let match = relevantFees.find(f => weight <= f.weightMax && weight >= f.weightMin);
            if (!match && relevantFees.length > 0) {
                const last = relevantFees[relevantFees.length - 1];
                if (weight > last.weightMax) match = last;
            }

            if (match) {
                weightFee = match.fee || 0;
                pickPack = match.pickAndPackFee || 0;
                if (match.useIncremental) {
                    const threshold = match.weightMin - 1;
                    const extra = Math.max(0, weight - threshold);
                    const mult = Math.ceil(extra / match.incrementalStep);
                    weightFee += mult * match.incrementalFee;
                }
            }
            const fulfilmentCost = weightFee + pickPack;

            // 4. Storage
            let storageCost = 0;
            if (item.dimensions) {
                try {
                    const parts = item.dimensions.replace(/[^0-9.x]/g, '').split('x').map(Number);
                    if (parts.length === 3) {
                        const [l, w, h] = parts;
                        const volCft = (l * w * h) / 28316.8;
                        const rate = storageFees.length > 0 ? storageFees[0].rate : 45;
                        storageCost = Number((volCft * rate).toFixed(2));
                        if (storageCost < 1) storageCost = 1;
                    }
                } catch (e) { }
            } else {
                storageCost = normSize === 'Standard' ? 5 : 20;
            }

            // 5. Tax & Totals
            const otherCost = Number(((referralFee + closingFee + fulfilmentCost) * GST_RATE).toFixed(2));
            const totalFees = Number((referralFee + closingFee + fulfilmentCost + storageCost + otherCost).toFixed(2));
            const netRevenue = Number((price - totalFees).toFixed(2));
            const margin = price > 0 ? Number(((netRevenue / price) * 100).toFixed(2)) : 0;

            // Return Fee
            const stepLevel = item.stapleLevel || 'Standard'; // Using stapleLevel as stepLevel proxy if needed, or add stepLevel to schema
            const refundProcFee = calculateReturnFee(price, stepLevel, itemCat, refundFees);
            const returnFee = Number((Math.max(0, totalFees - referralFee) + refundProcFee).toFixed(2));

            // Update ASIN
            item.feePreview = {
                referralFee, closingFee, shippingFee: weightFee, fbaFee: fulfilmentCost, storageFee: storageCost,
                tax: otherCost, totalFees, netRevenue, margin, calculatedAt: new Date()
            };

            // Also update flat fields if needed for backward comp or easy access
            item.lossPerReturn = returnFee;

            await item.save();
        }

        console.log('[FeeCalc] Completed');
    } catch (error) {
        console.error('Fee Calculation Calculation Error:', error);
        throw error;
    }
};

module.exports = { calculateProfits };
