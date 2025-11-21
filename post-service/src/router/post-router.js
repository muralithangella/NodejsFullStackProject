const express = require('express');
const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');   
const authMiddleware = require('../middleware/authMiddleware');
const { validatePost, sanitizeInput } = require('../middleware/validation');
const { createPost, getPost, getAllPosts, deletePost, updatePost, likePost } = require('../controller/post-controller');

const router = express.Router();

// Route-specific rate limiting
const createPostLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { success: false, message: 'Too many posts created, try again later.' }
});

const likeLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 30,
    message: { success: false, message: 'Too many like requests, try again later.' }
});

// Apply authentication to all routes
router.use(authMiddleware);

// Post routes with validation and rate limiting
router.post('/', createPostLimiter, sanitizeInput, validatePost, createPost);
router.get('/:id', getPost);
router.get('/', getAllPosts);
router.put('/:id', sanitizeInput, validatePost, updatePost);
router.delete('/:id', deletePost);
router.post('/:id/like', likeLimiter, likePost);

module.exports=router;

