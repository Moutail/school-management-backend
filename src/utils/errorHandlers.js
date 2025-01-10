// backend/src/utils/errorHandlers.js
const { AppError } = require('./errors');

// Utilitaire pour gérer les erreurs async
const catchAsync = fn => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

// Formater les erreurs pour qu'elles soient cohérentes
const formatError = (err) => {
    // Erreurs MongoDB
    if (err.code === 11000) {
        return new AppError('Donnée en double détectée', 400);
    }
    
    if (err.name === 'ValidationError') {
        const messages = Object.values(err.errors).map(error => error.message);
        return new AppError(messages.join('. '), 400);
    }

    if (err.name === 'CastError') {
        return new AppError('Donnée invalide', 400);
    }

    // Erreurs JWT
    if (err.name === 'JsonWebTokenError') {
        return new AppError('Token invalide', 401);
    }

    if (err.name === 'TokenExpiredError') {
        return new AppError('Token expiré', 401);
    }

    return err;
};

module.exports = {
    catchAsync,
    formatError,
    AppError
};