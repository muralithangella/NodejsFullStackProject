const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const postRouter = require('./router/post-router');
const logger = require('./utils/logger');
const dotenv=require('dotenv');
dotenv.config();
const mongoose = require('mongoose');

const app = express();

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
        },
    },
}));

// CORS configuration
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-user-id']
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: { success: false, message: 'Too many requests, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});
app.use('/api/', limiter);

// Compression middleware
app.use(compression());

// Body parsing with size limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Database connection with retry logic
const dbConnect = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI, {
            maxPoolSize: 10,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        });
        logger.info('Connected to MongoDB');
    } catch (error) {
        logger.error('Error connecting to MongoDB:', error.message);
        setTimeout(dbConnect, 5000); // Retry after 5 seconds
    }
};
dbConnect();

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ 
        success: true, 
        message: 'Post service is healthy',
        timestamp: new Date().toISOString()
    });
});

// Routes
app.use('/api/v1/posts', postRouter);

// Global error handler
app.use((err, req, res, next) => {
    logger.error(err.stack);
    res.status(500).json({ 
        success: false, 
        message: process.env.NODE_ENV === 'production' ? 'Something went wrong!' : err.message 
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ success: false, message: 'Route not found' });
});

const PORT = process.env.PORT || 3002;

app.listen(PORT, () => {
    logger.info(`Post-service is running on port ${PORT}`);
});