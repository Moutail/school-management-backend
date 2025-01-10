// src/routes/majorRoutes.js
const express = require('express');
const router = express.Router();
const majorController = require('../controllers/majorController');
const { protect, restrictTo } = require('../middleware/authMiddleware');
const { validate, schemas } = require('../middleware/validation');
const Joi = require('joi');

// Protection globale des routes
router.use(protect);
router.use(restrictTo(['major']));

// Routes pour les activités
router.route('/activities')
    .get(
        validate(Joi.object({
            startDate: Joi.date().iso(),
            endDate: Joi.date().iso().min(Joi.ref('startDate')),
            type: Joi.string().valid('HOMEWORK', 'PROJECT', 'EVENT', 'OTHER'),
            status: Joi.string().valid('PENDING', 'IN_PROGRESS', 'COMPLETED')
        }), 'query'),
        majorController.getActivities
    )
    .post(
        validate(Joi.object({
            title: Joi.string().required(),
            description: Joi.string(),
            deadline: Joi.date().iso().required(),
            type: Joi.string().valid('HOMEWORK', 'PROJECT', 'EVENT', 'OTHER').required(),
            participants: Joi.array().items(Joi.string().hex().length(24))
        })),
        majorController.createActivity
    );

router.route('/activities/:id')
    .put(
        validate(Joi.object({ id: Joi.string().hex().length(24).required() }), 'params'),
        validate(Joi.object({
            title: Joi.string(),
            description: Joi.string(),
            deadline: Joi.date().iso(),
            type: Joi.string().valid('HOMEWORK', 'PROJECT', 'EVENT', 'OTHER'),
            status: Joi.string().valid('PENDING', 'IN_PROGRESS', 'COMPLETED')
        }).min(1)),
        majorController.updateActivity
    )
    .delete(
        validate(Joi.object({ id: Joi.string().hex().length(24).required() }), 'params'),
        majorController.deleteActivity
    );

// Routes pour les statistiques
router.get('/stats/class', majorController.getClassStats);

router.get('/stats/attendance',
    validate(Joi.object({
        startDate: Joi.date().iso(),
        endDate: Joi.date().iso().min(Joi.ref('startDate')),
        course: Joi.string().hex().length(24)
    }), 'query'),
    majorController.getAttendanceStats
);

router.get('/stats/performance',
    validate(Joi.object({
        period: Joi.string().hex().length(24),
        course: Joi.string().hex().length(24)
    }), 'query'),
    majorController.getPerformanceStats
);

// Routes pour les alertes
router.route('/alerts')
    .get(
        validate(Joi.object({
            status: Joi.string().valid('ACTIVE', 'RESOLVED', 'DISMISSED'),
            priority: Joi.string().valid('LOW', 'MEDIUM', 'HIGH', 'URGENT'),
            startDate: Joi.date().iso(),
            endDate: Joi.date().iso().min(Joi.ref('startDate'))
        }), 'query'),
        majorController.getAlerts
    )
    .post(
        validate(Joi.object({
            title: Joi.string().required().max(100),
            message: Joi.string().required().max(1000),
            priority: Joi.string().valid('LOW', 'MEDIUM', 'HIGH', 'URGENT').required(),
            targetUsers: Joi.array().items(Joi.string().hex().length(24)),
            expiresAt: Joi.date().iso().greater('now')
        })),
        majorController.createAlert
    );

router.put('/alerts/:id',
    validate(Joi.object({ id: Joi.string().hex().length(24).required() }), 'params'),
    validate(Joi.object({
        title: Joi.string().max(100),
        message: Joi.string().max(1000),
        priority: Joi.string().valid('LOW', 'MEDIUM', 'HIGH', 'URGENT'),
        status: Joi.string().valid('ACTIVE', 'RESOLVED', 'DISMISSED'),
        expiresAt: Joi.date().iso().greater('now')
    }).min(1)),
    majorController.updateAlert
);

module.exports = router;