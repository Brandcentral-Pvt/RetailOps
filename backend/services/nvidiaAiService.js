const { sql, getPool, generateId } = require('../database/db');

const NVIDIA_INVOKE_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
const VISION_MODEL = "meta/llama-3.2-11b-vision-instruct";
const FAST_MODEL = "meta/llama-3.1-8b-instruct";

/**
 * NVIDIA AI Service — Product Intelligence Platform
 * 
 * Capabilities:
 * 1. Product image analysis (vision models)
 * 2. Listing quality scoring
 * 3. Compliance checking
 * 4. Auto-task generation from AI insights
 * 5. Image generation (when available)
 */
class NvidiaAiService {
    constructor() {
        this.apiKey = process.env.NVIDIA_NIM_API_KEY;
    }

    _checkKey() {
        if (!this.apiKey) throw new Error('NVIDIA_NIM_API_KEY not configured');
    }

    async _callNvidia(messages, options = {}) {
        this._checkKey();
        const response = await fetch(NVIDIA_INVOKE_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: options.model || FAST_MODEL,
                messages,
                max_tokens: options.max_tokens || 1024,
                temperature: options.temperature || 0.3,
                ...(options.json ? { response_format: { type: 'json_object' } } : {}),
            }),
        });

        if (!response.ok) {
            const errText = await response.text().catch(() => '');
            throw new Error(`NVIDIA API ${response.status}: ${errText.slice(0, 200)}`);
        }

        const data = await response.json();
        return data.choices?.[0]?.message?.content || '';
    }

    _parseJSON(text) {
        try {
            const cleaned = text.replace(/```json\n?|```/g, '').trim();
            return JSON.parse(cleaned);
        } catch (e) {
            console.error('[NvidiaAI] JSON parse failed:', text.slice(0, 200));
            throw new Error('AI returned invalid JSON');
        }
    }

    _getImageAsBase64(url) {
        return fetch(url).then(r => r.arrayBuffer()).then(buf => Buffer.from(buf).toString('base64')).catch(() => null);
    }

    // ═══════════════════════════════════════════════════════════════
    // 1. PRODUCT IMAGE ANALYSIS (Vision Model)
    // ═══════════════════════════════════════════════════════════════

    async analyzeProductImage(imageUrl, options = {}) {
        const imageBase64 = await this._getImageAsBase64(imageUrl);
        if (!imageBase64) throw new Error('Failed to fetch or convert image');

        const analysisType = options.type || 'full';
        const prompt = this._getImageAnalysisPrompt(analysisType);

        const content = await this._callNvidia([
            {
                role: 'user',
                content: [
                    { type: 'text', text: prompt },
                    { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } }
                ]
            }
        ], { model: VISION_MODEL, max_tokens: 1024, json: true });

        return this._parseJSON(content);
    }

    _getImageAnalysisPrompt(type) {
        const prompts = {
            full: `Analyze this Amazon product image comprehensively. Return JSON:
{
  "quality_score": <0-100>,
  "has_white_background": <boolean>,
  "has_high_resolution": <boolean>,
  "image_type": "main|lifestyle|infographic|info|size_chart",
  "compliance_issues": ["issue1", "issue2"],
  "visual_issues": ["issue1", "issue2"],
  "suggestions": ["suggestion1", "suggestion2"],
  "recreation_prompt": "Detailed prompt to recreate this product image with pure white background, 4K, studio lighting",
  "product_category": "detected category",
  "text_in_image": "any text detected in the image"
}`,
            compliance: `Check this Amazon product image against Amazon's Image Policy:
- Main image must have pure white (#FFFFFF) background
- Must be at least 1000px on longest side
- Product must fill 85%+ of frame
- No watermarks, text, logos, or badges on main image
- No accessories not included in the product

Return JSON:
{
  "passes_compliance": <boolean>,
  "white_background": <boolean>,
  "min_resolution": <boolean>,
  "product_fills_frame": <boolean>,
  "has_watermarks": <boolean>,
  "has_text_overlays": <boolean>,
  "violations": ["violation1"],
  "confidence": <0-100>
}`,
            ecommerce: `Analyze this product image for e-commerce best practices:
1. Is the background pure white?
2. Is the product clearly visible and well-lit?
3. Are there multiple angles or lifestyle context?
4. Does it meet marketplace requirements?

Return JSON:
{
  "score": <0-100>,
  "background_quality": "pure_white|near_white|colored|patterned",
  "lighting": "excellent|good|poor",
  "product_visibility": "excellent|good|poor",
  "issues": ["issue1"],
  "improvements": ["improvement1"]
}`
        };
        return prompts[type] || prompts.full;
    }

    // ═══════════════════════════════════════════════════════════════
    // 2. LISTING QUALITY SCORING (Text Analysis)
    // ═══════════════════════════════════════════════════════════════

    async analyzeListingQuality(asinData) {
        const prompt = `Analyze this Amazon product listing against best practices. Return JSON:
{
  "overall_score": <0-100>,
  "title": { "score": <0-100>, "issues": ["..."], "optimized": "..." },
  "bullets": { "score": <0-100>, "count": <number>, "issues": ["..."] },
  "description": { "score": <0-100>, "length": <chars>, "issues": ["..."] },
  "images": { "score": <0-100>, "count": <number>, "issues": ["..."] },
  "keywords": { "found": ["..."], "missing": ["..."] },
  "compliance": { "passes": <boolean>, "violations": ["..."] },
  "priority_tasks": [
    { "title": "...", "type": "TITLE|BULLET|IMAGE|DESCRIPTION|APLUS", "priority": "HIGH|MEDIUM|LOW", "impact": <0-100> }
  ]
}

Product Data:
ASIN: ${asinData.asinCode || 'N/A'}
Brand: ${asinData.brand || 'N/A'}
Title (${(asinData.title || '').length} chars): ${asinData.title || 'MISSING'}
LQS: ${asinData.lqs || 'N/A'}/10
Images: ${asinData.imagesCount || 0}
A+ Content: ${asinData.hasAplus ? 'Yes' : 'No'}
Bullet Points: ${asinData.bulletPoints || 0}
Description Length: ${asinData.descriptionLength || 0} chars
Rating: ${asinData.rating || 'N/A'}
Reviews: ${asinData.reviewCount || 0}`;

        const content = await this._callNvidia([
            { role: 'system', content: 'You are an Amazon Seller Central content policy expert. Always return valid JSON.' },
            { role: 'user', content: prompt }
        ], { json: true, max_tokens: 3000 });

        return this._parseJSON(content);
    }

    // ═══════════════════════════════════════════════════════════════
    // 3. BATCH PRODUCT ANALYSIS
    // ═══════════════════════════════════════════════════════════════

    async batchAnalyzeImages(asinIds, options = {}) {
        const pool = await getPool();
        const results = [];
        const batchSize = 5;

        for (let i = 0; i < asinIds.length; i += batchSize) {
            const batch = asinIds.slice(i, i + batchSize);
            const batchResults = await Promise.all(batch.map(async (asinId) => {
                try {
                    const result = await pool.request()
                        .input('id', sql.VarChar, asinId)
                        .query('SELECT Id, AsinCode, ImageUrl, Title, SellerId FROM Asins WHERE Id = @asinId');
                    const asin = result.recordset[0];
                    if (!asin || !asin.ImageUrl) return { asinId, error: 'No image URL' };

                    const analysis = await this.analyzeProductImage(asin.ImageUrl, options);
                    return { asinId, asinCode: asin.AsinCode, title: asin.Title, ...analysis };
                } catch (e) {
                    return { asinId, error: e.message };
                }
            }));
            results.push(...batchResults);
        }

        return results;
    }

    // ═══════════════════════════════════════════════════════════════
    // 4. IMAGE AUDIT + AUTO-TASK CREATION
    // ═══════════════════════════════════════════════════════════════

    async auditAsinImage(asinId) {
        this._checkKey();

        try {
            const pool = await getPool();
            const result = await pool.request()
                .input('id', sql.VarChar, asinId)
                .query("SELECT * FROM Asins WHERE Id = @asinId");
            const asin = result.recordset[0];
            if (!asin || !asin.ImageUrl) return null;

            console.log(`[AI-AUDIT] Analyzing image for ASIN: ${asin.AsinCode}...`);
            const analysis = await this.analyzeProductImage(asin.ImageUrl, { type: 'compliance' });

            // Update ASIN metadata
            let lqsDetails = {};
            try { lqsDetails = JSON.parse(asin.LqsDetails || '{}'); } catch (e) {}
            lqsDetails.hasWhiteBackground = analysis.white_background === 'pure_white';
            lqsDetails.hasHighResolution = analysis.min_resolution;
            lqsDetails.imageComplianceScore = analysis.confidence || 0;
            lqsDetails.imageAuditDate = new Date().toISOString();

            await pool.request()
                .input('id', sql.VarChar, asinId)
                .input('lqsDetails', sql.NVarChar, JSON.stringify(lqsDetails))
                .query("UPDATE Asins SET LqsDetails = @lqsDetails, UpdatedAt = dbo.GetEnvDate() WHERE Id = @asinId");

            // Create tasks for violations
            if (analysis.violations && analysis.violations.length > 0) {
                await this._createImageAuditTask(asin, analysis);
            }

            return analysis;
        } catch (error) {
            console.error('[AI-AUDIT] Error:', error.message);
            return null;
        }
    }

    async _createImageAuditTask(asin, analysis) {
        const pool = await getPool();
        const title = `Optimize Image: ${asin.AsinCode}`;
        const description = `AI Vision Audit Results:\n` +
            `White Background: ${analysis.white_background || 'unknown'}\n` +
            `Resolution: ${analysis.min_resolution ? 'OK' : 'Too low'}\n` +
            `Violations: ${(analysis.violations || []).join(', ') || 'None'}\n` +
            `Confidence: ${analysis.confidence || 0}%`;

        // Check for existing open task
        const existing = await pool.request()
            .input('asinId', sql.VarChar, asin.Id)
            .query("SELECT Id FROM Actions WHERE AsinId = @asinId AND Type = 'IMAGE_OPTIMIZATION' AND Status IN ('PENDING', 'IN_PROGRESS')");

        if (existing.recordset.length === 0) {
            const id = generateId();
            await pool.request()
                .input('Id', sql.VarChar, id)
                .input('Title', sql.NVarChar, title)
                .input('Description', sql.NVarChar, description)
                .input('Type', sql.NVarChar, 'IMAGE_OPTIMIZATION')
                .input('Priority', sql.NVarChar, 'High')
                .input('Status', sql.NVarChar, 'PENDING')
                .input('AsinId', sql.VarChar, asin.Id)
                .input('SellerId', sql.VarChar, asin.SellerId)
                .input('CreatedBy', sql.VarChar, asin.SellerId)
                .query(`
                    INSERT INTO Actions (Id, Title, Description, Type, Priority, Status, AsinId, SellerId, CreatedBy, CreatedAt, UpdatedAt)
                    VALUES (@Id, @Title, @Description, @Type, @Priority, @Status, @AsinId, @SellerId, @CreatedBy, dbo.GetEnvDate(), dbo.GetEnvDate())
                `);
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // 5. IMAGE GENERATION (fallback — not available on current NVIDIA API)
    // ═══════════════════════════════════════════════════════════════

    async generateProductImage(prompt, asinCode) {
        console.log(`[AI-IMAGE] Image generation not available on current NVIDIA plan. Prompt saved for manual generation.`);
        return null;
    }

    // ═══════════════════════════════════════════════════════════════
    // 6. COMPETITOR PRICE ANALYSIS (Text Model)
    // ═══════════════════════════════════════════════════════════════

    async analyzePricingStrategy(asinData) {
        const prompt = `Analyze this product's pricing position. Return JSON:
{
  "pricing_score": <0-100>,
  "current_strategy": "competitive|premium|budget|unknown",
  "price_vs_category": "above|at|below",
  "discount_effective": <boolean>,
  "recommendations": ["..."],
  "optimal_price_range": { "min": <number>, "max": <number>, "currency": "INR" }
}

ASIN: ${asinData.asinCode}
Title: ${asinData.title}
Current Price: ₹${asinData.currentPrice || 0}
MRP: ₹${asinData.mrp || 0}
Discount: ${asinData.discountPercentage || 0}%
BSR: ${asinData.bsr || 'N/A'}
Category: ${asinData.category || 'N/A'}
Brand: ${asinData.brand || 'N/A'}`;

        const content = await this._callNvidia([
            { role: 'system', content: 'You are an Amazon marketplace pricing strategist. Return valid JSON.' },
            { role: 'user', content: prompt }
        ], { json: true, max_tokens: 1500 });

        return this._parseJSON(content);
    }

    // ═══════════════════════════════════════════════════════════════
    // 7. INVENTORY & STOCK ANALYSIS
    // ═══════════════════════════════════════════════════════════════

    async analyzeInventoryRisk(asinData) {
        const prompt = `Analyze inventory and stock risk for this product. Return JSON:
{
  "risk_level": "critical|high|medium|low",
  "risk_score": <0-100>,
  "stock_status": "out_of_stock|low_stock|healthy|overstocked",
  "days_until_stockout": <number or null>,
  "reorder_urgency": "immediate|within_week|within_month|not_needed",
  "recommendations": ["..."]
}

ASIN: ${asinData.asinCode}
Stock Level: ${asinData.stockLevel || 0}
Availability: ${asinData.availabilityStatus || 'Unknown'}
BSR: ${asinData.bsr || 'N/A'}
Total Orders: ${asinData.totalOrders || 0}
Rating: ${asinData.rating || 'N/A'}`;

        const content = await this._callNvidia([
            { role: 'system', content: 'You are an Amazon inventory management expert. Return valid JSON.' },
            { role: 'user', content: prompt }
        ], { json: true, max_tokens: 1000 });

        return this._parseJSON(content);
    }
}

module.exports = new NvidiaAiService();
