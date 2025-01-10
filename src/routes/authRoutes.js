// src/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController'); // Assurez-vous que ce fichier existe
const { protect } = require('../middleware/authMiddleware'); // Assurez-vous que ce fichier existe
const Joi = require('joi');

// Schémas de validation
const schemas = {
    register: Joi.object({
        email: Joi.string().email().required().messages({
            'string.email': 'Email invalide',
            'any.required': 'Email requis'
        }),
        password: Joi.string().min(8).required().messages({
            'string.min': 'Le mot de passe doit contenir au moins 8 caractères',
            'any.required': 'Mot de passe requis'
        }),
        firstName: Joi.string().required().messages({
            'any.required': 'Prénom requis'
        }),
        lastName: Joi.string().required().messages({
            'any.required': 'Nom requis'
        }),
        role: Joi.string().valid('student', 'professor', 'admin').default('student')
    }),

    login: Joi.object({
        email: Joi.string().email().required().messages({
            'string.email': 'Email invalide',
            'any.required': 'Email requis'
        }),
        password: Joi.string().required().messages({
            'any.required': 'Mot de passe requis'
        })
    }),

    forgotPassword: Joi.object({
        email: Joi.string().email().required().messages({
            'string.email': 'Email invalide',
            'any.required': 'Email requis'
        })
    }),

    resetPassword: Joi.object({
        password: Joi.string().min(8).required().messages({
            'string.min': 'Le mot de passe doit contenir au moins 8 caractères',
            'any.required': 'Nouveau mot de passe requis'
        }),
        passwordConfirm: Joi.string().valid(Joi.ref('password')).required().messages({
            'any.only': 'Les mots de passe ne correspondent pas',
            'any.required': 'Confirmation du mot de passe requise'
        })
    }),

    updatePassword: Joi.object({
        currentPassword: Joi.string().required().messages({
            'any.required': 'Mot de passe actuel requis'
        }),
        newPassword: Joi.string().min(8).required().messages({
            'string.min': 'Le nouveau mot de passe doit contenir au moins 8 caractères',
            'any.required': 'Nouveau mot de passe requis'
        }),
        passwordConfirm: Joi.string().valid(Joi.ref('newPassword')).required().messages({
            'any.only': 'Les mots de passe ne correspondent pas',
            'any.required': 'Confirmation du mot de passe requise'
        })
    })
};


if (process.env.NODE_ENV === 'development') {
    router.delete('/test/cleanup', async (req, res) => {
        try {
            // Supprime tous les utilisateurs
            await User.deleteMany({});
            // Supprime aussi les préférences utilisateur associées
            await UserPreference.deleteMany({});
            // Supprime les logs d'activité
            await ActivityLog.deleteMany({});
            
            res.status(200).json({
                status: 'success',
                message: 'Tous les utilisateurs ont été supprimés'
            });
        } catch (error) {
            res.status(500).json({
                status: 'error',
                message: error.message
            });
        }
    });
}
// Middleware de validation
const validate = (schema) => (req, res, next) => {
    const { error } = schema.validate(req.body, {
        abortEarly: false,
        allowUnknown: true,
        stripUnknown: true
    });

    if (error) {
        const errors = error.details.map(detail => ({
            field: detail.path[0],
            message: detail.message
        }));

        return res.status(400).json({
            status: 'error',
            message: 'Données invalides',
            errors
        });
    }

    next();
};

// Routes publiques
router.post('/register', validate(schemas.register), authController.register);
router.post('/login', validate(schemas.login), authController.login);
router.post('/forgot-password', validate(schemas.forgotPassword), authController.forgotPassword);
router.post('/reset-password/:token', validate(schemas.resetPassword), authController.resetPassword);

// Routes protégées
router.use(protect); // Protection des routes suivantes

router.post('/logout', authController.logout);
router.patch('/update-password', validate(schemas.updatePassword), authController.updatePassword);
router.get('/me', (req, res) => {
    res.status(200).json({
        status: 'success',
        data: {
            user: req.user
        }
    });
});

// Gestionnaire d'erreurs pour les routes
router.use((err, req, res, next) => {
    if (err.name === 'ValidationError') {
        return res.status(400).json({
            status: 'error',
            message: 'Données invalides',
            errors: Object.values(err.errors).map(error => ({
                field: error.path,
                message: error.message
            }))
        });
    }

    next(err);
});

module.exports = router;