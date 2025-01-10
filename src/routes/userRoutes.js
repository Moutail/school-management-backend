// src/routes/userRoutes.js
const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { protect, restrictTo } = require('../middleware/authMiddleware');
const { validate, schemas } = require('../middleware/validation');
const Joi = require('joi');  // Ajout de l'import Joi
const upload = require('../utils/multer-config');

// Protection globale des routes
router.use(protect);

// Routes du profil
router.get('/profile', userController.getProfile);

router.patch('/profile',
    validate(Joi.object({
        firstName: Joi.string(),
        lastName: Joi.string(),
        email: Joi.string().email(),
        phoneNumber: Joi.string(),
        address: Joi.object({
            street: Joi.string(),
            city: Joi.string(),
            postalCode: Joi.string()
        })
    }).min(1)),
    upload.single('profileImage'),
    userController.updateProfile
);

router.patch('/profile/password',
    validate(Joi.object({
        currentPassword: Joi.string().required(),
        newPassword: Joi.string().min(8).required(),
        confirmPassword: Joi.string().valid(Joi.ref('newPassword')).required()
    })),
    userController.updatePassword
);

// Routes d'administration des utilisateurs
router.get('/users',
    restrictTo(['admin']),
    validate(Joi.object({
        role: Joi.string().valid('student', 'professor', 'admin', 'parent', 'major'),
        search: Joi.string(),
        status: Joi.string().valid('active', 'inactive', 'blocked'),
        class: Joi.string().hex().length(24),
        page: Joi.number().min(1).default(1),
        limit: Joi.number().min(1).max(100).default(10),
        sortBy: Joi.string().valid('firstName', 'lastName', 'createdAt', 'role').default('createdAt'),
        order: Joi.string().valid('asc', 'desc').default('desc')
    }).options({ stripUnknown: true })),
    userController.getAllUsers
);

router.get('/users/:id',
    restrictTo(['admin']),
    validate(Joi.object({
        id: Joi.string().hex().length(24).required()
    }), 'params'),
    userController.getUserById
);

// Routes pour les préférences utilisateur
router.get('/preferences', userController.getUserPreferences);

router.patch('/preferences',
    validate(Joi.object({
        theme: Joi.string().valid('light', 'dark', 'system').default('system'),
        language: Joi.string().valid('fr', 'en').default('fr'),
        notifications: Joi.object({
            email: Joi.boolean(),
            push: Joi.boolean(),
            types: Joi.array().items(
                Joi.string().valid('COURSE', 'GRADE', 'ATTENDANCE', 'EVENT', 'ANNOUNCEMENT')
            )
        })
    })),
    userController.updatePreferences
);

// Route pour les statistiques utilisateur
router.get('/stats',
    restrictTo(['admin']),
    validate(Joi.object({
        startDate: Joi.date().iso(),
        endDate: Joi.date().iso().min(Joi.ref('startDate')),
        role: Joi.string().valid('student', 'professor', 'admin', 'parent', 'major')
    }), 'query'),
    userController.getUserStats
);

module.exports = router;