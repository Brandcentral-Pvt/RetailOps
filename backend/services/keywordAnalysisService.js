const AIService = require('./AIService');
const keywordResearchService = require('./keywordResearchService');

class KeywordAnalysisService {
    async analyze(params) {
        const { keyword, itemCount = 10 } = params;
        if (!keyword || !keyword.trim()) throw new Error('Keyword is required');

        const searchResult = await keywordResearchService.searchItems({
            keywords: keyword,
            itemCount: Math.min(itemCount, 20),
            sortBy: 'Featured',
        });

        const products = searchResult.items || [];
        if (products.length === 0) {
            return { keyword, products: [], analysis: null, message: 'No products found for analysis' };
        }

        const productData = products.map(p => ({
            title: p.title,
            brand: p.brand,
            category: p.category,
            price: p.price,
            rating: p.rating,
            reviewCount: p.reviewCount,
            bsr: p.mainBSR,
            bulletPoints: (p.bulletPoints || []).slice(0, 5),
            color: p.color,
            size: p.size,
        }));

        const analysis = await this._runAIKeywordAnalysis(keyword, productData);

        return { keyword, products: productData, analysis };
    }

    async _runAIKeywordAnalysis(seedKeyword, products) {
        const titles = products.map(p => p.title).filter(Boolean);
        const brands = [...new Set(products.map(p => p.brand).filter(Boolean))];
        const categories = [...new Set(products.map(p => p.category).filter(Boolean))];
        const features = products.flatMap(p => p.bulletPoints || []).filter(Boolean).slice(0, 30);
        const avgPrice = products.filter(p => p.price).reduce((s, p) => s + p.price, 0) / (products.filter(p => p.price).length || 1);
        const avgRating = products.filter(p => p.rating).reduce((s, p) => s + p.rating, 0) / (products.filter(p => p.rating).length || 1);

        const prompt = {
            seedKeyword: seedKeyword,
            topProductTitles: titles.slice(0, 10),
            topBrands: brands.slice(0, 8),
            categories: categories.slice(0, 5),
            keyFeatures: features.slice(0, 20),
            marketMetrics: { avgPrice: Math.round(avgPrice), avgRating: avgRating.toFixed(1), totalProductsAnalyzed: products.length },
        };

        const systemPrompt = `You are an Amazon Keyword Research & SEO Expert AI. Analyze the provided product data and extract high-value keyword opportunities.

Return ONLY a valid JSON object with this exact structure (no markdown, no explanation):
{
  "suggestedKeywords": [
    {
      "keyword": "string",
      "type": "head | body | long-tail",
      "opportunityScore": 0-100,
      "searchVolume": "High | Medium | Low",
      "competition": "High | Medium | Low",
      "rationale": "string - why this keyword is valuable"
    }
  ],
  "keywordGaps": [
    {
      "category": "string",
      "missingKeywords": ["string"]
    }
  ],
  "categoryOpportunities": [
    {
      "category": "string",
      "suggestedKeywords": ["string"]
    }
  ],
  "trendingTerms": ["string"],
  "summary": {
    "bestOpportunity": "string - the single best keyword to target",
    "strategy": "string - 2-3 sentence keyword strategy"
  }
}

Rules:
- suggestedKeywords: Provide 10-15 keywords. Mix head terms (1-2 words), body terms (2-3 words), and long-tail (4+ words). Score 0-100 based on relevance + opportunity.
- keywordGaps: Identify 2-3 category gaps where no products appeared but there's potential.
- trendingTerms: Extract 3-5 trending/modern terms from product titles and features.
- All prices are in INR (₹). The marketplace is Amazon.in.
- Focus on actionable keywords that real shoppers use.`;

        const userPrompt = JSON.stringify(prompt, null, 2);

        const content = await AIService.chat([
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
        ], { model: 'meta/llama-3.1-8b-instruct', temperature: 0.3, json: true });

        try {
            const cleaned = content.replace(/```json\n?|```/g, '').trim();
            return JSON.parse(cleaned);
        } catch {
            console.error('[KW Analysis] Failed to parse AI response:', content.substring(0, 300));
            return this._fallbackAnalysis(seedKeyword, products);
        }
    }

    _fallbackAnalysis(seedKeyword, products) {
        const brands = [...new Set(products.map(p => p.brand).filter(Boolean))];
        const categories = [...new Set(products.map(p => p.category).filter(Boolean))];
        const words = products.flatMap(p => (p.title || '').toLowerCase().split(/\s+/)).filter(w => w.length > 3);
        const freq = {};
        words.forEach(w => { freq[w] = (freq[w] || 0) + 1; });
        const topWords = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([w]) => w);

        return {
            suggestedKeywords: topWords.map((w, i) => ({
                keyword: w,
                type: i < 5 ? 'body' : 'long-tail',
                opportunityScore: Math.max(100 - i * 8, 30),
                searchVolume: i < 5 ? 'Medium' : 'Low',
                competition: i < 5 ? 'Medium' : 'Low',
                rationale: `Extracted from top product titles`,
            })),
            keywordGaps: categories.map(c => ({ category: c || 'General', missingKeywords: [`best ${c?.toLowerCase()}`, `trending ${c?.toLowerCase()}`, `premium ${c?.toLowerCase()}`] })),
            categoryOpportunities: brands.slice(0, 3).map(b => ({ category: b || 'Brand', suggestedKeywords: [`${b} products`, `buy ${b} online`, `${b} deals`] })),
            trendingTerms: topWords.slice(0, 5),
            summary: {
                bestOpportunity: seedKeyword,
                strategy: `Focus on "${seedKeyword}" and related long-tail variations. Top brands in this space: ${brands.slice(0, 3).join(', ') || 'N/A'}. Average price point: ₹${Math.round(products.filter(p => p.price).reduce((s, p) => s + p.price, 0) / (products.filter(p => p.price).length || 1))}.`,
            },
        };
    }
}

module.exports = new KeywordAnalysisService();
