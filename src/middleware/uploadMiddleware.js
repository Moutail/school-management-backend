// src/middleware/uploadMiddleware.js
const fileService = require('../services/fileService');
const { AppError } = require('../utils/errors');

const uploadMiddleware = {
    single: (fieldName, options = {}) => {
        const upload = fileService.configureUpload(options);
        
        return (req, res, next) => {
            upload.single(fieldName)(req, res, async (err) => {
                if (err) {
                    return next(new AppError(err.message, 400));
                }
                if (!req.file) {
                    return next(new AppError('Aucun fichier fourni', 400));
                }

                const errors = await fileService.validateFile(req.file);
                if (errors.length > 0) {
                    await fileService.deleteFile(req.file.path);
                    return next(new AppError(errors.join(', '), 400));
                }

                next();
            });
        };
    },

    multiple: (fieldName, maxCount = 5, options = {}) => {
        const upload = fileService.configureUpload(options);
        
        return (req, res, next) => {
            upload.array(fieldName, maxCount)(req, res, async (err) => {
                if (err) {
                    return next(new AppError(err.message, 400));
                }
                if (!req.files || req.files.length === 0) {
                    return next(new AppError('Aucun fichier fourni', 400));
                }

                for (const file of req.files) {
                    const errors = await fileService.validateFile(file);
                    if (errors.length > 0) {
                        await Promise.all(req.files.map(f => fileService.deleteFile(f.path)));
                        return next(new AppError(errors.join(', '), 400));
                    }
                }

                next();
            });
        };
    }
};

module.exports = uploadMiddleware;