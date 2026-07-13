const express = require('express');
const router = express.Router();
const aiGoalController = require('../controllers/aiGoalController');
const aiTaskController = require('../controllers/aiTaskController');
const nvidiaAiService = require('../services/nvidiaAiService');
const { authenticate } = require('../middleware/auth');

/**
 * Brandcentral AI Strategy Routes
 */

// AI GOAL LIFECYCLE
router.post('/goals/ai-preview', authenticate, aiGoalController.getPreview);
router.post('/goals/ai-create', authenticate, aiGoalController.createFullStrategy);

// AI TASK LIFECYCLE
router.post('/tasks/ai-create', authenticate, aiTaskController.createEnrichedTask);
router.post('/generate-recovery-tasks', authenticate, aiTaskController.generateRecoveryTasks);

// ═══════════════════════════════════════════════════════════════
// PRODUCT INTELLIGENCE (NVIDIA Vision AI)
// ═══════════════════════════════════════════════════════════════

// Analyze a single product image
router.post('/product/analyze-image', authenticate, async (req, res) => {
    try {
        const { imageUrl, type } = req.body;
        if (!imageUrl) return res.status(400).json({ success: false, error: 'imageUrl required' });
        const result = await nvidiaAiService.analyzeProductImage(imageUrl, { type });
        res.json({ success: true, data: result });
    } catch (error) {
        console.error('[AI] Image analysis error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Analyze listing quality
router.post('/product/analyze-listing', authenticate, async (req, res) => {
    try {
        const { asinCode, title, brand, lqs, imagesCount, hasAplus, bulletPoints, descriptionLength, rating, reviewCount } = req.body;
        const result = await nvidiaAiService.analyzeListingQuality({
            asinCode, title, brand, lqs, imagesCount, hasAplus, bulletPoints, descriptionLength, rating, reviewCount
        });
        res.json({ success: true, data: result });
    } catch (error) {
        console.error('[AI] Listing analysis error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Analyze pricing strategy
router.post('/product/analyze-pricing', authenticate, async (req, res) => {
    try {
        const result = await nvidiaAiService.analyzePricingStrategy(req.body);
        res.json({ success: true, data: result });
    } catch (error) {
        console.error('[AI] Pricing analysis error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Analyze inventory risk
router.post('/product/analyze-inventory', authenticate, async (req, res) => {
    try {
        const result = await nvidiaAiService.analyzeInventoryRisk(req.body);
        res.json({ success: true, data: result });
    } catch (error) {
        console.error('[AI] Inventory analysis error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Audit a single ASIN's image (creates task if non-compliant)
router.post('/product/audit-image/:asinId', authenticate, async (req, res) => {
    try {
        const result = await nvidiaAiService.auditAsinImage(req.params.asinId);
        if (!result) return res.status(404).json({ success: false, error: 'ASIN not found or no image' });
        res.json({ success: true, data: result });
    } catch (error) {
        console.error('[AI] Image audit error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Batch audit multiple ASINs
router.post('/product/batch-audit-images', authenticate, async (req, res) => {
    try {
        const { asinIds, type } = req.body;
        if (!asinIds || !Array.isArray(asinIds) || asinIds.length === 0) {
            return res.status(400).json({ success: false, error: 'asinIds array required' });
        }
        const results = await nvidiaAiService.batchAnalyzeImages(asinIds, { type });
        res.json({ success: true, data: results, count: results.length });
    } catch (error) {
        console.error('[AI] Batch audit error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
