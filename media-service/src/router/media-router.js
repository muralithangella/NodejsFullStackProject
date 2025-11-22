const express = require('express');
const multer = require('multer');
const { uploadMedia } = require('../controller/media-controller');
const authMiddleware = require('../middleware/authMiddleware');
const logger = require('../utils/logger');

const router = express.Router();

// Use memory storage for Cloudinary upload
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 100 * 1024 * 1024 // 100MB limit
    }
});

// Test route without multer
router.post('/test', (req, res) => {
    res.json({ success: true, headers: req.headers, contentType: req.get('content-type') });
});

router.post('/upload', upload.single('media'), uploadMedia);

module.exports = router;