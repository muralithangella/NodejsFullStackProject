const express = require('express');
const multer = require('multer');
const { uploadMedia, getMedia, getAllMedia } = require('../controller/media-controller');
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

//router.post('/upload', upload.single('media'), uploadMedia);
router.post('/upload', authMiddleware, upload.single('media'), uploadMedia);
router.get('/getAllMedia',authMiddleware,getAllMedia);

module.exports = router;