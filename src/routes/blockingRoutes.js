// src/routes/blockingRoutes.js
const express = require('express');
const router = express.Router();
const blockingController = require('../controllers/blockingController');
const { protect, restrictTo } = require('../middleware/authMiddleware');
const { validate, schemas } = require('../middleware/validation');
const Joi = require('joi');  // Ajout de l'import de Joi

// Protection globale des routes
router.use(protect);
router.use(restrictTo(['admin']));

// Route pour basculer le blocage d'un étudiant
router.post(
    '/students/:studentId/toggle-block',
    validate(Joi.object({
        reason: Joi.string().required(),
        duration: Joi.number().min(1).max(365).optional(), // durée en jours
        notify: Joi.boolean().default(true)
    })),
    blockingController.toggleBlock
);

// Route pour obtenir la liste des étudiants bloqués
router.get(
    '/blocked-students',
    validate(Joi.object({
        page: Joi.number().min(1).default(1),
        limit: Joi.number().min(1).max(100).default(10),
        sortBy: Joi.string().valid('firstName', 'lastName', 'blockedAt').default('blockedAt'),
        order: Joi.string().valid('asc', 'desc').default('desc'),
        class: Joi.string().hex().length(24).optional(),
        search: Joi.string().optional()
    }).options({ stripUnknown: true }), 'query'),
    blockingController.getBlockedStudents
);

// Route pour obtenir l'historique des blocages d'un étudiant
router.get(
    '/students/:studentId/blocking-history',
    validate(Joi.object({
        studentId: Joi.string().hex().length(24).required()
    }), 'params'),
    blockingController.getBlockingHistory
);

// Route pour débloquer un étudiant
router.post(
    '/students/:studentId/unblock',
    validate(Joi.object({
        reason: Joi.string().required(),
        notify: Joi.boolean().default(true)
    })),
    blockingController.unblockStudent
);

module.exports = router;