// src/middleware/roleMiddleware.js
const { AppError } = require('./errorHandler');

const checkRole = (roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return next(new AppError('Non authentifié', 401));
        }

        if (!roles.includes(req.user.role)) {
            return next(new AppError('Non autorisé pour cette action', 403));
        }

        next();
    };
};

module.exports = checkRole;