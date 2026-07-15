const keywordAnalysisService = require('../services/keywordAnalysisService');

exports.analyze = async (req, res) => {
    try {
        const { keyword, itemCount } = req.query;
        if (!keyword || !keyword.trim()) {
            return res.status(400).json({ success: false, error: 'Keyword is required' });
        }

        const result = await keywordAnalysisService.analyze({
            keyword: keyword.trim(),
            itemCount: Math.min(Math.max(Number(itemCount) || 10, 5), 20),
        });

        res.json({ success: true, ...result });
    } catch (error) {
        console.error('[KW Analysis Controller] Error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
};
