const ApiKey = require('../models/ApiKey');

// Get all API keys (masked values)
exports.getKeys = async (req, res) => {
    try {
        const keys = await ApiKey.find().sort({ createdAt: -1 });

        // Mask the values before sending to client
        const maskedKeys = keys.map(k => {
            const keyObj = k.toObject();
            const val = keyObj.value;
            if (val && val.length > 8) {
                keyObj.value = val.slice(0, 4) + '•'.repeat(Math.max(6, val.length - 8)) + val.slice(-4);
            } else if (val) {
                keyObj.value = '•'.repeat(val.length);
            }
            return keyObj;
        });

        res.json({ success: true, data: maskedKeys });
    } catch (error) {
        console.error('Get API Keys Error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Create a new API key
exports.createKey = async (req, res) => {
    try {
        const { name, serviceId, value, category, description } = req.body;

        const newKey = await ApiKey.create({
            name,
            serviceId,
            value,
            category,
            description,
            createdBy: req.user.id
        });

        res.status(201).json({ success: true, data: newKey });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ success: false, message: 'Service ID must be unique' });
        }
        console.error('Create API Key Error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Update an API key
exports.updateKey = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        const key = await ApiKey.findByIdAndUpdate(id, updates, { new: true, runValidators: true });

        if (!key) {
            return res.status(404).json({ success: false, message: 'Key not found' });
        }

        res.json({ success: true, data: key });
    } catch (error) {
        console.error('Update API Key Error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Delete an API key
exports.deleteKey = async (req, res) => {
    try {
        const { id } = req.params;
        const key = await ApiKey.findByIdAndDelete(id);

        if (!key) {
            return res.status(404).json({ success: false, message: 'Key not found' });
        }

        res.json({ success: true, message: 'Key deleted successfully' });
    } catch (error) {
        console.error('Delete API Key Error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Reveal an API key value (secure)
exports.revealKey = async (req, res) => {
    try {
        const { id } = req.params;
        const key = await ApiKey.findById(id);

        if (!key) {
            return res.status(404).json({ success: false, message: 'Key not found' });
        }

        res.json({ success: true, value: key.value });
    } catch (error) {
        console.error('Reveal API Key Error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
