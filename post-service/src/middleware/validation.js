const Joi = require('joi');
const logger = require('../utils/logger');

const postValidation = Joi.object({
    title: Joi.string().min(3).max(200).required().trim(),
    content: Joi.string().min(10).max(5000).required().trim(),
    media: Joi.string().uri().optional(),
    category: Joi.string().min(2).max(50).optional().trim(),
});

const validatePost = (req, res, next) => {
    const { error } = postValidation.validate(req.body);
    if (error) {
        logger.error(`Validation error: ${error.details[0].message}`);
        return res.status(400).json({
            success: false,
            message: error.details[0].message
        });
    }
    next();
};

const sanitizeInput = (req, res, next) => {
    if (req.body.title) {
        req.body.title = req.body.title.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    }
    if (req.body.content) {
        req.body.content = req.body.content.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    }
    next();
};

module.exports = { validatePost, sanitizeInput };