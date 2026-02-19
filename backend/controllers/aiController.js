const AIService = require('../services/AIService');

exports.generateOKR = async (req, res) => {
    try {
        const { prompt, type, industry } = req.body;

        if (!prompt) {
            return res.status(400).json({ success: false, message: 'Prompt is required' });
        }

        const okrData = await AIService.generateOKR(prompt, type, industry);
        res.json({ success: true, data: okrData });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to generate OKR', error: error.message });
    }
};

exports.suggestTasks = async (req, res) => {
    try {
        const { context } = req.body;

        if (!context) {
            return res.status(400).json({ success: false, message: 'Context is required' });
        }

        const tasks = await AIService.suggestTasks(context);
        res.json({ success: true, data: tasks });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to suggest tasks', error: error.message });
    }
};
