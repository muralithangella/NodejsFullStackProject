const cloudinary=require('cloudinary').v2;
const fs=require('fs');
const logger = require('../utils/logger');
require('dotenv').config();

console.log('Cloudinary config:', {
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY ? 'SET' : 'NOT SET',
    api_secret: process.env.CLOUDINARY_API_SECRET ? 'SET' : 'NOT SET'
});

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const uploadImageToCloudinary = async (file) => {
    try {
        if (!file || !file.buffer) {
            throw new Error('No file or buffer provided');
        }
        
        return new Promise((resolve, reject) => {
            cloudinary.uploader.upload_stream(
                {
                    folder: 'posts',
                    resource_type: 'auto',
                    chunk_size: 6000000,
                    use_filename: true,
                    unique_filename: false
                },
                (error, result) => {
                    if (error) {
                        logger.error(`Cloudinary upload error: ${error.message}`);
                        reject(error);
                    } else {
                        resolve(result);
                    }
                }
            ).end(file.buffer);
        });
    } catch (error) {
        logger.error(`Cloudinary upload error: ${error.message}`);
        throw error;
    }
};

module.exports = { uploadImageToCloudinary };