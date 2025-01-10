//src/middleware/validation/schemas.js
const Joi = require('joi');

// Définir d'abord objectId car il est utilisé par d'autres schémas
const objectId = Joi.string().pattern(/^[0-9a-fA-F]{24}$/);

const schemas = {
    objectId,
    
    pagination: Joi.object({
        page: Joi.number().min(1).default(1),
        limit: Joi.number().min(1).max(100).default(10),
        sort: Joi.string(),
        order: Joi.string().valid('asc', 'desc').default('desc')
    }),

    dateRange: Joi.object({
        startDate: Joi.date().iso(),
        endDate: Joi.date().iso().min(Joi.ref('startDate'))
    }),

    auth: {
        register: Joi.object({
            email: Joi.string().email().required(),
            password: Joi.string().min(8).required(),
            firstName: Joi.string().required(),
            lastName: Joi.string().required(),
            role: Joi.string().valid('student', 'professor', 'admin', 'parent').required(),
            username: Joi.string().min(3).required(),
            // Mise à jour du pattern pour le numéro de téléphone
            phoneNumber: Joi.string()
                .pattern(/^(\+33|0)[1-9](\d{2}){4}$|^\+1[2-9]\d{9}$|^\+228[0-9]{8}$/)
                .messages({
                    'string.pattern.base': 'Numéro de téléphone invalide. Formats acceptés: +33XXXXXXXXX, 0XXXXXXXXX (France), +1XXXXXXXXXX (Canada), +228XXXXXXXX (Togo)'
                })
                .allow(''),  // Permet un numéro vide
            class: Joi.when('role', {
                is: 'student',
                then: Joi.string()
                    .valid('6e', '5e', '4e', '3e')
                    .required()
                    .messages({
                        'any.required': 'La classe est requise pour les étudiants',
                        'any.only': 'Classe invalide'
                    }),
                otherwise: Joi.string().optional()
            })
        })
    },

    user: {
        update: Joi.object({
            firstName: Joi.string(),
            lastName: Joi.string(),
            email: Joi.string().email(),
            phoneNumber: Joi.string(),
            address: Joi.object({
                street: Joi.string(),
                city: Joi.string(),
                postalCode: Joi.string()
            })
        }).min(1)
    },

    course: {
        create: Joi.object({
            title: Joi.string().required(),
            code: Joi.string().required(),
            description: Joi.string(),
            professor: objectId.required(),
            startDate: Joi.date().iso().required(),
            endDate: Joi.date().iso().min(Joi.ref('startDate')).required()
        }),

        update: Joi.object({
            title: Joi.string(),
            description: Joi.string(),
            professor: objectId,
            startDate: Joi.date().iso(),
            endDate: Joi.date().iso().min(Joi.ref('startDate'))
        }).min(1)
    },

    attendance: {
        create: Joi.object({
            studentId: objectId.required(),
            courseId: objectId.required(),
            date: Joi.date().iso().required(),
            status: Joi.string().valid('PRESENT', 'ABSENT', 'LATE', 'EXCUSED').required()
        }),

        update: Joi.object({
            status: Joi.string().valid('PRESENT', 'ABSENT', 'LATE', 'EXCUSED'),
            note: Joi.string().max(500),
            justification: Joi.object({
                reason: Joi.string().required(),
                document: Joi.string().uri(),
                status: Joi.string().valid('PENDING', 'APPROVED', 'REJECTED')
            })
        }).min(1)
    },

    document: {
        upload: Joi.object({
            title: Joi.string().required().max(200),
            type: Joi.string().valid('COURSE', 'EXERCISE', 'RESOURCE', 'HOMEWORK').required(),
            courseId: objectId.required(),
            chapterId: objectId,
            description: Joi.string().max(1000),
            visibility: Joi.string().valid('ALL', 'SPECIFIC_GROUPS').default('ALL'),
            targetGroups: Joi.when('visibility', {
                is: 'SPECIFIC_GROUPS',
                then: Joi.array().items(objectId).min(1).required(),
                otherwise: Joi.forbidden()
            }),
            tags: Joi.array().items(Joi.string().max(50))
        }),

        update: Joi.object({
            title: Joi.string().max(200),
            type: Joi.string().valid('COURSE', 'EXERCISE', 'RESOURCE', 'HOMEWORK'),
            description: Joi.string().max(1000),
            visibility: Joi.string().valid('ALL', 'SPECIFIC_GROUPS'),
            targetGroups: Joi.when('visibility', {
                is: 'SPECIFIC_GROUPS',
                then: Joi.array().items(objectId).min(1),
                otherwise: Joi.forbidden()
            }),
            status: Joi.string().valid('ACTIVE', 'ARCHIVED', 'HIDDEN'),
            tags: Joi.array().items(Joi.string().max(50))
        }).min(1)
    },

    schedule: {
        create: Joi.object({
            course: objectId.required(),
            professor: objectId.required(),
            room: objectId.required(),
            startTime: Joi.string().pattern(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/).required(),
            endTime: Joi.string().pattern(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/).required(),
            day: Joi.number().min(0).max(6).required(),
            type: Joi.string().valid('COURSE', 'EXAM', 'EVENT').required(),
            recurrence: Joi.object({
                type: Joi.string().valid('WEEKLY', 'BIWEEKLY', 'MONTHLY'),
                until: Joi.date().iso().greater('now')
            })
        }),

        update: Joi.object({
            room: objectId,
            startTime: Joi.string().pattern(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/),
            endTime: Joi.string().pattern(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/),
            status: Joi.string().valid('SCHEDULED', 'CANCELLED', 'COMPLETED'),
            recurrence: Joi.object({
                type: Joi.string().valid('WEEKLY', 'BIWEEKLY', 'MONTHLY'),
                until: Joi.date().iso().greater('now')
            })
        }).min(1)
    },

    notification: {
        create: Joi.object({
            recipients: Joi.alternatives().try(
                objectId,
                Joi.array().items(objectId)
            ).required(),
            type: Joi.string().valid('SYSTEM', 'ACTIVITY', 'EVENT', 'ALERT', 'GRADE', 'ATTENDANCE').required(),
            title: Joi.string().required().max(100),
            message: Joi.string().required().max(1000),
            priority: Joi.string().valid('LOW', 'MEDIUM', 'HIGH', 'URGENT').default('MEDIUM'),
            scheduledFor: Joi.date().iso().min('now'),
            expiresAt: Joi.date().iso().min('now'),
            metadata: Joi.object()
        })
    }
};

module.exports = schemas;