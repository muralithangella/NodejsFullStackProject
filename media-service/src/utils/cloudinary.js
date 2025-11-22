const cloudinary=require('cloudinary').v2;
const logger = require('../utils/logger');
require('dotenv').config();

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

const deleteImageFromCloudinary = async (publicId) => {
    try {
        const result = await cloudinary.uploader.destroy(publicId);
        logger.info(`Cloudinary delete result: ${JSON.stringify(result)}`);
        return result;
    } catch (error) {
        logger.error(`Cloudinary delete error: ${error.message}`);
        throw error;
    }
};

module.exports = { uploadImageToCloudinary ,deleteImageFromCloudinary};