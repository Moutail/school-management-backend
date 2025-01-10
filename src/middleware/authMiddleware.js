// src/middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const { promisify } = require('util');
const User = require('../models/userModel');
const { AppError } = require('../utils/errors');

const protect = async (req, res, next) => {
    try {
        // 1) Get token
        let token;
        if (req.headers.authorization?.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        }

        if (!token) {
            return next(new AppError('Not authenticated. Please log in.', 401));
        }

        // 2) Verify token
        const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

        // 3) Check if user still exists
        const user = await User.findById(decoded.userId);
        if (!user) {
            return next(new AppError('User no longer exists.', 401));
        }

        // 4) Check if user is blocked
        if (user.isBlocked) {
            return next(new AppError('Your account has been blocked. Please contact support.', 403));
        }

        // Grant access to protected route
        req.user = user;
        next();
    } catch (error) {
        return next(new AppError('Invalid token or session expired.', 401));
    }
};

const restrictTo = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return next(new AppError('You do not have permission to perform this action', 403));
        }
        next();
    };
};

module.exports = {
    protect,
    restrictTo
};