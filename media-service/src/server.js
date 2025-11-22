const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const logger = require('./utils/logger');
const errorHandler = require('./middleware/errorHandler');
const mediaRouter = require('./router/media-router');
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3003;

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

//Rate limiting - disabled for testing
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { success: false, message: 'Too many requests, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});
app.use('/api/', limiter);

// Compression middleware
app.use(compression());

// Skip body parsing for multipart uploads
// app.use(express.json({ limit: '50mb' }));
// app.use(express.urlencoded({ extended: true, limit: '50mb' }));

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
        setTimeout(dbConnect, 5000);
    }
};
dbConnect();

// Health check endpoint
app.get('/health', (req, res) => {
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    const isHealthy = mongoose.connection.readyState === 1;
    
    res.status(isHealthy ? 200 : 503).json({ 
        success: isHealthy, 
        message: isHealthy ? 'Media service is healthy' : 'Media service is unhealthy',
        timestamp: new Date().toISOString(),
        database: dbStatus
    });
});

// Routes
app.use('/api/media', mediaRouter);

// Global error handler
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
    res.status(404).json({ success: false, message: 'Route not found' });
});

let server;
let isShuttingDown = false;

// Graceful shutdown function
const gracefulShutdown = async (signal) => {
    if (isShuttingDown) {
        logger.warn('Shutdown already in progress, forcing exit...');
        process.exit(1);
    }
    
    isShuttingDown = true;
    logger.info(`${signal} signal received. Starting graceful shutdown...`);
    
    if (server) {
        server.close(async (err) => {
            if (err) {
                logger.error('Error during server close:', err);
            } else {
                logger.info('HTTP server closed');
            }
            
            try {
                if (mongoose.connection.readyState === 1) {
                    await mongoose.connection.close();
                    logger.info('MongoDB connection closed');
                }
                
                logger.info('Graceful shutdown completed');
                process.exit(0);
            } catch (error) {
                logger.error('Error during graceful shutdown:', error);
                process.exit(1);
            }
        });
        
        setTimeout(() => {
            logger.error('Graceful shutdown timeout, forcing exit');
            process.exit(1);
        }, 30000);
    } else {
        process.exit(0);
    }
};

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception:', {
        message: err.message,
        stack: err.stack,
        name: err.name
    });
    gracefulShutdown('UNCAUGHT_EXCEPTION');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection:', {
        reason: reason,
        promise: promise,
        stack: reason?.stack
    });
    gracefulShutdown('UNHANDLED_REJECTION');
});

// Handle shutdown signals
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGHUP', () => gracefulShutdown('SIGHUP'));

// Start server
server = app.listen(PORT, () => {
    logger.info(`Media-service is running on port ${PORT}`);
    logger.info(`Process ID: ${process.pid}`);
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Handle server errors
server.on('error', (err) => {
    logger.error('Server error:', err);
    if (err.code === 'EADDRINUSE') {
        logger.error(`Port ${PORT} is already in use`);
        process.exit(1);
    }
});

