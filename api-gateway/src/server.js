const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const logger = require('./utils/logger');
const proxy = require('express-http-proxy');
const errorHandler = require('./middleware/errorHandler');
const { authenticateToken, refreshToken } = require('./middleware/auth');
dotenv.config();


const app = express();

// Security middleware
app.use(helmet());

// Rate limiting - disabled for testing
// const limiter = rateLimit({
//     windowMs: 15 * 60 * 1000,
//     max: 1000,
//     message: { success: false, message: 'Too many requests' },
//     standardHeaders: true
// });
// app.use(limiter);

app.use(cors());

// Skip body parsing for media uploads
app.use('/api/v1/media', (req, res, next) => next());

// Body parsing for other routes
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
const PORT = process.env.PORT || 3000;
const IDENTITY_SERVICE_URL = process.env.IDENTITY_SERVICE_URL || 'http://localhost:3001';
const POST_SERVICE_URL = process.env.POST_SERVICE_URL || 'http://localhost:3002';
const MEDIA_SERVICE_URL = process.env.MEDIA_SERVICE_URL || 'http://localhost:3003';

if (!process.env.IDENTITY_SERVICE_URL) {
    logger.warn('IDENTITY_SERVICE_URL not set, using default: http://localhost:3001');
}
if (!process.env.POST_SERVICE_URL) {
    logger.warn('POST_SERVICE_URL not set, using default: http://localhost:3002');
}

// Health check
app.get('/health', (req, res) => {
    res.status(200).json({ 
        success: true, 
        message: 'API Gateway is healthy',
        timestamp: new Date().toISOString()
    });
});

// Refresh token endpoint
app.post('/api/v1/refresh', refreshToken);

app.use((req, res, next) => {
    logger.info(`${req.method} ${req.url}`);
    next();
});

// Protected routes (require authentication)
app.use('/api/v1/posts', authenticateToken, proxy(POST_SERVICE_URL, {
    proxyReqPathResolver: (req) => req.originalUrl,
    timeout: 30000,
    proxyErrorHandler: (err, res, next) => {
        logger.error(`Post service proxy error: ${err.message}`);
        res.status(503).json({ success: false, message: 'Post service unavailable' });
    }
}));

// Protected routes (require authentication)
app.use('/api/v1/media', authenticateToken, proxy(MEDIA_SERVICE_URL, {
    proxyReqPathResolver: (req) => req.originalUrl.replace('/api/v1/media', '/api/media'),
    timeout: 120000,
    parseReqBody: false,
    proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
        if (srcReq.headers['content-type']) {
            proxyReqOpts.headers['content-type'] = srcReq.headers['content-type'];
        }
        proxyReqOpts.headers['x-user-id'] = srcReq.headers['x-user-id'];
        return proxyReqOpts;
    },
    proxyErrorHandler: (err, res, next) => {
        logger.error(`Media service proxy error: ${err.message}`);
        res.status(503).json({ success: false, message: 'Media service unavailable' });
    }
}));

// Public routes (no authentication required)
app.use('/api/v1', proxy(IDENTITY_SERVICE_URL, {
    proxyReqPathResolver: (req) => req.originalUrl,
    timeout: 30000,
    proxyErrorHandler: (err, res, next) => {
        logger.error(`Identity service proxy error: ${err.message}`);
        res.status(503).json({ success: false, message: 'Identity service unavailable' });
    }
}));

app.use(errorHandler);

let server;
let isShuttingDown = false;

// Graceful shutdown
const gracefulShutdown = (signal) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    logger.info(`${signal} received. Shutting down gracefully...`);
    
    if (server) {
        server.close(() => {
            logger.info('API Gateway shutdown completed');
            process.exit(0);
        });
        
        setTimeout(() => {
            logger.error('Forced shutdown');
            process.exit(1);
        }, 30000);
    }
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

server = app.listen(PORT, () => {
    logger.info(`API Gateway is running on port ${PORT}`);
    logger.info(`Identity Service URL: ${IDENTITY_SERVICE_URL}`);
    logger.info(`Post Service URL: ${POST_SERVICE_URL}`);
    logger.info(`Media Service URL: ${MEDIA_SERVICE_URL}`);
});

server.on('error', (err) => {
    logger.error('Server error:', err);
    if (err.code === 'EADDRINUSE') {
        logger.error(`Port ${PORT} is already in use`);
        process.exit(1);
    }
});
