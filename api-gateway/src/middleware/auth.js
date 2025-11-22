const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    logger.info(`Auth header: ${authHeader}`);
    logger.info(`Token: ${token}`);
    logger.info(`JWT_ACCESS_SECRET: ${process.env.JWT_ACCESS_SECRET}`);

    if (!token) {
        return res.status(401).json({ success: false, message: 'Access token required' });
    }

    jwt.verify(token, process.env.JWT_ACCESS_SECRET, (err, user) => {
        if (err) {
            logger.error(`JWT verification error: ${err.message}`);
            if (err.name === 'TokenExpiredError') {
                return res.status(401).json({ success: false, message: 'Access token expired' });
            }
            return res.status(403).json({ success: false, message: 'Invalid access token' });
        }
        
        logger.info(`Decoded user: ${JSON.stringify(user)}`);
        // Add user info to headers for downstream services
        req.headers['x-user-id'] = user.userId || user.id;
        req.headers['x-user-email'] = user.email;
        
        logger.info(`Authenticated user: ${user.userId || user.id}`);
        next();
    });
};

const refreshToken = (req, res, next) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
        return res.status(401).json({ success: false, message: 'Refresh token required' });
    }

    jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ success: false, message: 'Invalid refresh token' });
        }

        const accessToken = jwt.sign(
            { userId: user.userId, email: user.email },
            process.env.JWT_ACCESS_SECRET,
            { expiresIn: '15m' }
        );

        res.json({ success: true, accessToken });
    });
};

module.exports = { authenticateToken, refreshToken };