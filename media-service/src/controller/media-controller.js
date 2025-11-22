const logger = require('../utils/logger');
const { uploadImageToCloudinary } = require('../utils/cloudinary');
const { Media } = require('../models/media');

const uploadMedia = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }

        const { originalname, mimetype, buffer } = req.file;
        const userId = req.userId || '507f1f77bcf86cd799439011';
        
        logger.info(`Uploading media: ${originalname}`);
        
        const cloudinaryResult = await uploadImageToCloudinary(req.file);
        
        const newMedia = new Media({
            originalName: originalname,
            mimeType: mimetype,
            publicId: cloudinaryResult.public_id,
            url: cloudinaryResult.secure_url,
            user: userId,
        });
        
        await newMedia.save();
        
        res.status(201).json({
            success: true,
            message: 'Media uploaded successfully',
            media: {
                id: newMedia._id,
                url: cloudinaryResult.secure_url,
                publicId: cloudinaryResult.public_id
            }
        });
        
    } catch (error) {
        logger.error(`Error uploading media: ${error.message}`);
        logger.error(`Error stack: ${error.stack}`);
        res.status(500).json({ success: false, message: 'Error uploading media', error: error.message });
    }
};

module.exports = { uploadMedia };