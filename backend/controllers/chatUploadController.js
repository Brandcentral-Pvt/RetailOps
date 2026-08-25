const multer = require('multer');
const fs = require('fs');
// SECURITY (F1 capability URLs): chat files are served publicly under
// /uploads/chat — the old fieldname+timestamp+weak-PRNG name was guessable.
// New uploads get a 192-bit random name; the original name is returned to
// the client (and stored with the message) for display only.
const { randomFileName } = require('../utils/safeUploadName');

// Configure storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = 'uploads/chat/';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const allowedExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf', '.doc',
            '.docx', '.xls', '.xlsx', '.txt', '.mp4', '.mp3', '.wav', '.ogg', '.webm'];
        cb(null, randomFileName(file.originalname, allowedExts));
    }
});

// File filter
const fileFilter = (req, file, cb) => {
    const allowedTypes = [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
        'application/pdf', 'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain', 'video/mp4', 'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/mp4'
    ];

    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type: ' + file.mimetype), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 20 * 1024 * 1024 } // 20MB limit
});

exports.uploadChatFile = (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }

        // Relative URL for the frontend
        const fileUrl = `/uploads/chat/${req.file.filename}`;
        res.json({
            success: true,
            data: {
                url: fileUrl,
                originalName: req.file.originalname,
                mimetype: req.file.mimetype,
                size: req.file.size
            }
        });
    } catch (error) {
        console.error('Chat upload error:', error);
        res.status(500).json({ success: false, message: 'Server error during upload' });
    }
};

exports.chatUploadMiddleware = upload.single('file');
