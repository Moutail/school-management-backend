// src/routes/notificationRoutes.js
const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../middleware/authMiddleware');
const { validate, schemas } = require('../middleware/validation');
const notificationController = require('../controllers/notificationController');
const Joi = require('joi');

router.use(protect);

router.get('/',
    validate(Joi.object({
        page: Joi.number().min(1).default(1),
        limit: Joi.number().min(1).max(50).default(20),
        type: Joi.string().valid('SYSTEM', 'ACTIVITY', 'EVENT', 'ALERT', 'GRADE', 'ATTENDANCE'),
        isRead: Joi.boolean(),
        startDate: Joi.date().iso(),
        endDate: Joi.date().iso().min(Joi.ref('startDate')),
        priority: Joi.string().valid('LOW', 'MEDIUM', 'HIGH', 'URGENT')
    }), 'query'),
    notificationController.getNotifications
);

router.post('/',
    restrictTo(['admin', 'professor', 'major']),
    validate(Joi.object({
        recipients: Joi.alternatives().try(
            Joi.string().hex().length(24),
            Joi.array().items(Joi.string().hex().length(24))
        ).required(),
        type: Joi.string().valid('SYSTEM', 'ACTIVITY', 'EVENT', 'ALERT', 'GRADE', 'ATTENDANCE').required(),
        title: Joi.string().required().max(100),
        message: Joi.string().required().max(1000),
        priority: Joi.string().valid('LOW', 'MEDIUM', 'HIGH', 'URGENT').default('MEDIUM'),
        scheduledFor: Joi.date().iso().min('now'),
        expiresAt: Joi.date().iso().min('now'),
        relatedResource: Joi.object({
            type: Joi.string().valid('COURSE', 'ACTIVITY', 'EVENT', 'GRADE', 'ATTENDANCE').required(),
            id: Joi.string().hex().length(24).required()
        }),
        actionUrl: Joi.string().uri(),
        metadata: Joi.object()
    })),
    notificationController.createNotification
);

router.patch('/:id/read',
    validate(Joi.object({
        id: Joi.string().hex().length(24).required()
    }), 'params'),
    notificationController.markAsRead
);

router.post('/mark-multiple-read',
    validate(Joi.object({
        ids: Joi.array().items(Joi.string().hex().length(24)).min(1).required()
    })),
    notificationController.markMultipleAsRead
);

router.post('/mark-all-read',
    validate(Joi.object({
        beforeDate: Joi.date().iso(),
        type: Joi.string().valid('SYSTEM', 'ACTIVITY', 'EVENT', 'ALERT', 'GRADE', 'ATTENDANCE')
    })),
    notificationController.markAllAsRead
);

router.delete('/:id',
    validate(Joi.object({
        id: Joi.string().hex().length(24).required()
    }), 'params'),
    notificationController.deleteNotification
);

router.get('/preferences',
    notificationController.getNotificationPreferences
);

router.patch('/preferences',
    validate(Joi.object({
        email: Joi.object({
            enabled: Joi.boolean(),
            frequency: Joi.string().valid('IMMEDIATE', 'DAILY', 'WEEKLY'),
            types: Joi.array().items(
                Joi.string().valid('SYSTEM', 'ACTIVITY', 'EVENT', 'ALERT', 'GRADE', 'ATTENDANCE')
            )
        }),
        push: Joi.object({
            enabled: Joi.boolean(),
            types: Joi.array().items(
                Joi.string().valid('SYSTEM', 'ACTIVITY', 'EVENT', 'ALERT', 'GRADE', 'ATTENDANCE')
            )
        }),
        doNotDisturb: Joi.object({
            enabled: Joi.boolean(),
            startTime: Joi.string().pattern(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/),
            endTime: Joi.string().pattern(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/)
        })
    })),
    notificationController.updateNotificationPreferences
);

module.exports = router;