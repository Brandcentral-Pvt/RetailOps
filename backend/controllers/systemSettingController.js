const SystemSetting = require('../models/SystemSetting');

exports.getSettings = async (req, res) => {
    try {
        const { group } = req.query;
        const query = group ? { group } : {};
        const settings = await SystemSetting.find(query);

        // Convert to a more usable object format if needed, or just return the array
        const settingsMap = {};
        settings.forEach(s => {
            settingsMap[s.key] = s.value;
        });

        res.json({
            success: true,
            data: settingsMap
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.updateSettings = async (req, res) => {
    try {
        const { settings } = req.body;
        if (!settings || typeof settings !== 'object') {
            return res.status(400).json({ success: false, message: 'Invalid settings data' });
        }

        const updates = Object.entries(settings).map(([key, value]) => {
            return SystemSetting.findOneAndUpdate(
                { key },
                {
                    value,
                    updatedBy: req.userId,
                    group: req.body.group || 'general'
                },
                { upsert: true, new: true }
            );
        });

        await Promise.all(updates);

        res.json({
            success: true,
            message: 'Settings updated successfully'
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getSettingByKey = async (req, res) => {
    try {
        const setting = await SystemSetting.findOne({ key: req.params.key });
        if (!setting) {
            return res.status(404).json({ success: false, message: 'Setting not found' });
        }
        res.json({ success: true, data: setting.value });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const emailService = require('../services/emailService');

exports.testEmail = async (req, res) => {
    try {
        const { to } = req.body;
        if (!to) {
            return res.status(400).json({ success: false, message: 'Recipient email required' });
        }

        const success = await emailService.sendEmail(
            to,
            'GMS Dashboard - SMTP Test',
            '<h3>SMTP Configuration Successful</h3><p>If you are reading this, your GMS Dashboard SMTP settings are correctly configured!</p>'
        );

        if (success) {
            res.json({ success: true, message: 'Test email sent successfully' });
        } else {
            res.status(500).json({ success: false, message: 'Failed to send test email. Check server logs.' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
