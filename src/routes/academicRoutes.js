// src/routes/academicRoutes.js
const express = require('express');
const router = express.Router();
const academicController = require('../controllers/academicController');
const { protect, restrictTo } = require('../middleware/authMiddleware');
const Joi = require('joi');
const cache = require('../config/cache');
const { validate, schemas } = require('../middleware/validation');

// Middleware pour le cache
const cacheMiddleware = async (req, res, next) => {
    try {
        const cacheKey = 'academic:periods';
        const cachedData = await cache.get(cacheKey);
        if (cachedData) {
            return res.json(JSON.parse(cachedData));
        }
        next();
    } catch (error) {
        next(error);
    }
};

// Validation schemas
const academicSchemas = {
    periodCreate: Joi.object({
        name: Joi.string().required(),
        startDate: Joi.date().iso().required(),
        endDate: Joi.date().iso().min(Joi.ref('startDate')).required(),
        description: Joi.string()
    }),
    periodUpdate: Joi.object({
        name: Joi.string(),
        startDate: Joi.date().iso(),
        endDate: Joi.date().iso(),
        description: Joi.string()
    }).min(1)
};

// Routes
router.use(protect); // Protection globale des routes

// Routes des périodes académiques
router.get('/periods', 
    cacheMiddleware,
    academicController.getPeriods
);

router.post('/periods',
    restrictTo(['admin']),
    validate(academicSchemas.periodCreate),
    academicController.createPeriod
);

router.put('/periods/:id',
    restrictTo(['admin']),
    validate(schemas.periodUpdate),
    academicController.updatePeriod
);

router.delete('/periods/:id',
    restrictTo(['admin']),
    academicController.deletePeriod
);

// Routes des rapports
router.get('/reports', 
    restrictTo(['admin', 'professor']),
    validate(Joi.object({
        periodId: Joi.string().hex().length(24),
        type: Joi.string().valid('ATTENDANCE', 'PERFORMANCE', 'GRADES'),
        startDate: Joi.date().iso(),
        endDate: Joi.date().iso()
    }), 'query'),
    academicController.getReports
);

router.post('/reports/generate', 
    restrictTo(['admin', 'professor']),
    validate(Joi.object({
        periodId: Joi.string().hex().length(24).required(),
        type: Joi.string().valid('ATTENDANCE', 'PERFORMANCE', 'GRADES').required(),
        format: Joi.string().valid('pdf', 'excel').default('pdf')
    })),
    academicController.generateReport
);

// Routes des statistiques
router.get('/stats',
    restrictTo(['admin', 'professor']),
    academicController.getAcademicStats
);

router.get('/periods/:id/stats',
    validate(Joi.object({
        id: Joi.string().hex().length(24).required()
    }), 'params'),
    academicController.getPeriodStats
);

module.exports = router;