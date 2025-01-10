// src/routes/scheduleRoutes.js

const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../middleware/authMiddleware');
const { validate } = require('../middleware/validation');
const scheduleController = require('../controllers/scheduleController');
const Joi = require('joi');

// Schémas de validation
const scheduleSchemas = {
    slotQuery: Joi.object({
        type: Joi.string().valid('COURSE', 'EXAM', 'EVENT'),
        classId: Joi.string().hex().length(24),
        professorId: Joi.string().hex().length(24),
        startDate: Joi.date().iso(),
        endDate: Joi.date().iso().min(Joi.ref('startDate')),
        roomId: Joi.string().hex().length(24),
        courseId: Joi.string().hex().length(24)
    }),

    createSlot: Joi.object({
        course: Joi.string().hex().length(24).required(),
        professor: Joi.string().hex().length(24).required(),
        class: Joi.string().hex().length(24).required(),
        room: Joi.string().hex().length(24).required(),
        type: Joi.string().valid('COURSE', 'EXAM', 'EVENT').required(),
        startTime: Joi.string().pattern(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/).required(),
        endTime: Joi.string().pattern(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/).required(),
        day: Joi.number().min(0).max(6).required(),
        date: Joi.date().iso().required(),
        recurrence: Joi.object({
            type: Joi.string().valid('WEEKLY', 'BIWEEKLY', 'MONTHLY'),
            until: Joi.date().iso().greater('now')
        }),
        description: Joi.string().max(500)
    }),

    checkConflicts: Joi.object({
        startTime: Joi.string().pattern(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/).required(),
        endTime: Joi.string().pattern(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/).required(),
        day: Joi.number().min(0).max(6).required(),
        date: Joi.date().iso().required(),
        room: Joi.string().hex().length(24),
        professor: Joi.string().hex().length(24),
        class: Joi.string().hex().length(24),
        excludeSlotId: Joi.string().hex().length(24)
    }),

    roomQuery: Joi.object({
        date: Joi.date().iso(),
        startTime: Joi.string().pattern(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/),
        endTime: Joi.string().pattern(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/),
        capacity: Joi.number().integer().min(1),
        features: Joi.array().items(Joi.string())
    }),

    updateSlot: Joi.object({
        course: Joi.string().hex().length(24),
        room: Joi.string().hex().length(24),
        startTime: Joi.string().pattern(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/),
        endTime: Joi.string().pattern(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/),
        type: Joi.string().valid('COURSE', 'EXAM', 'EVENT'),
        description: Joi.string().max(500),
        status: Joi.string().valid('SCHEDULED', 'CANCELLED', 'COMPLETED')
    }).min(1)
};

// Protection globale des routes
router.use(protect);

// Routes pour les créneaux horaires
router.get('/slots', 
    validate(scheduleSchemas.slotQuery, 'query'),
    scheduleController.getTimeSlots
);

router.post('/slots', 
    restrictTo(['admin', 'professor']), 
    validate(scheduleSchemas.createSlot), 
    scheduleController.createTimeSlot
);

// Routes pour la gestion des conflits
router.post('/check-conflicts', 
    validate(scheduleSchemas.checkConflicts), 
    scheduleController.checkConflicts
);

// Routes pour les salles
router.get('/rooms', 
    validate(scheduleSchemas.roomQuery, 'query'), 
    scheduleController.getRooms
);

router.get('/rooms/stats', 
    restrictTo(['admin']), 
    validate(Joi.object({
        startDate: Joi.date().iso(),
        endDate: Joi.date().iso().min(Joi.ref('startDate')),
        roomId: Joi.string().hex().length(24)
    }), 'query'), 
    scheduleController.getRoomStats
);

// Routes pour les emplois du temps spécifiques
router.get('/slots/class/:classId',
    validate(Joi.object({ classId: Joi.string().hex().length(24).required() }), 'params'),
    validate(scheduleSchemas.slotQuery, 'query'),
    scheduleController.getClassSchedule
);

router.get('/slots/professor/:professorId',
    validate(Joi.object({ professorId: Joi.string().hex().length(24).required() }), 'params'),
    validate(scheduleSchemas.slotQuery, 'query'),
    scheduleController.getProfessorSchedule
);

// Routes pour la gestion des créneaux individuels
router.put('/slots/:slotId',
    restrictTo(['admin', 'professor']),
    validate(Joi.object({ slotId: Joi.string().hex().length(24).required() }), 'params'),
    validate(scheduleSchemas.updateSlot),
    scheduleController.updateTimeSlot
);

router.post('/slots/:slotId/cancel',
    restrictTo(['admin', 'professor']),
    validate(Joi.object({ slotId: Joi.string().hex().length(24).required() }), 'params'),
    validate(Joi.object({
        reason: Joi.string().required().max(500),
        notify: Joi.boolean().default(true)
    })),
    scheduleController.cancelTimeSlot
);

module.exports = router;