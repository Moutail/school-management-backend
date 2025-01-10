// src/routes/adminRoute.js
const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../middleware/authMiddleware'); // Assurez-vous que ce fichier existe
const { validate, schemas } = require('../middleware/validation'); // Assurez-vous que ce fichier existe
const adminController = require('../controllers/adminController'); // Assurez-vous que ce fichier existe
const Joi = require('joi');
const mongoose = require('mongoose'); // Ajout de l'import manquant

// Protection globale des routes admin
router.use(protect);
router.use(restrictTo(['admin']));

// Routes de gestion des privilèges
router.post('/privileges', validate(Joi.object({
    userId: Joi.string().hex().length(24).required(),
    role: Joi.string().valid('SUPER_ADMIN', 'MANAGER', 'SUPERVISOR').required(),
    permissions: Joi.array().items(
        Joi.string().valid(
            'MANAGE_USERS',
            'MANAGE_COURSES',
            'MANAGE_FINANCE',
            'VIEW_STATS',
            'MANAGE_SETTINGS'
        )
    ).min(1).required()
})), adminController.grantAdminPrivilege);

router.get('/privileges', validate(Joi.object({
    role: Joi.string().valid('SUPER_ADMIN', 'MANAGER', 'SUPERVISOR'),
    userId: Joi.string().hex().length(24)
}), 'query'), adminController.getAdminPrivileges);

// Routes de gestion des étudiants
router.patch('/students/:studentId/status', validate(Joi.object({
    studentId: Joi.string().hex().length(24).required()
}), 'params'), validate(Joi.object({
    isBlocked: Joi.boolean().required(),
    reason: Joi.string().required(),
    duration: Joi.when('isBlocked', {
        is: true,
        then: Joi.number().min(1).max(365).required(),
        otherwise: Joi.forbidden()
    })
})), adminController.updateStudentStatus);

router.patch('/students/:studentId/info', validate(Joi.object({
    studentId: Joi.string().hex().length(24).required()
}), 'params'), validate(Joi.object({
    firstName: Joi.string(),
    lastName: Joi.string(),
    email: Joi.string().email(),
    phoneNumber: Joi.string(),
    address: Joi.object({
        street: Joi.string(),
        city: Joi.string(),
        postalCode: Joi.string()
    }),
    parentInfo: Joi.object({
        name: Joi.string(),
        phone: Joi.string(),
        email: Joi.string().email()
    })
}).min(1)), adminController.updateStudentInfo);

// Routes de gestion des frais de scolarité
router.get('/tuition/:studentId', validate(Joi.object({
    studentId: Joi.string().hex().length(24).required()
}), 'params'), adminController.getTuitionBalance);

router.post('/tuition/payment', validate(Joi.object({
    studentId: Joi.string().hex().length(24).required(),
    amount: Joi.number().positive().required(),
    paymentMethod: Joi.string().valid('CASH', 'CARD', 'TRANSFER').required(),
    description: Joi.string(),
    academicYear: Joi.string().hex().length(24).required()
})), adminController.recordTuitionPayment);

// Routes de statistiques et rapports
router.get('/stats/students', validate(Joi.object({
    startDate: Joi.date().iso(),
    endDate: Joi.date().iso().min(Joi.ref('startDate')),
    status: Joi.string().valid('ACTIVE', 'BLOCKED', 'GRADUATED'),
    class: Joi.string().hex().length(24)
}), 'query'), adminController.getStudentStats);

router.get('/stats/tuition', validate(Joi.object({
    academicYear: Joi.string().hex().length(24),
    status: Joi.string().valid('PAID', 'PENDING', 'OVERDUE'),
    class: Joi.string().hex().length(24)
}), 'query'), adminController.getTuitionStats);

// Routes de configuration système
router.get('/settings', adminController.getSystemSettings);

router.patch('/settings', validate(Joi.object({
    academicYear: Joi.object({
        startDate: Joi.date().iso(),
        endDate: Joi.date().iso().min(Joi.ref('startDate'))
    }),
    tuitionSettings: Joi.object({
        lateFeePercentage: Joi.number().min(0).max(100),
        gracePeriodDays: Joi.number().min(0)
    }),
    notificationSettings: Joi.object({
        enableEmailNotifications: Joi.boolean(),
        enableSMSNotifications: Joi.boolean(),
        notificationTypes: Joi.array().items(
            Joi.string().valid('TUITION', 'ATTENDANCE', 'GRADES', 'DISCIPLINE')
        )
    })
}).min(1)), adminController.updateSystemSettings);

module.exports = router;