// src/routes/documentRoutes.js
const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../middleware/authMiddleware');
const { validate, schemas } = require('../middleware/validation');
const uploadMiddleware = require('../middleware/uploadMiddleware');
const documentController = require('../controllers/documentController');
const Joi = require('joi');

// Protection globale des routes
router.use(protect);

// Upload de documents de cours
router.post('/course-materials',
    restrictTo(['professor']),
    validate(Joi.object({
        courseId: Joi.string().hex().length(24).required(),
        periodId: Joi.string().hex().length(24).required(),
        chapterId: Joi.string().hex().length(24),
        type: Joi.string().valid('COURSE', 'EXERCISE', 'RESOURCE', 'HOMEWORK').required(),
        title: Joi.string().max(200),
        description: Joi.string().max(1000),
        visibility: Joi.string().valid('ALL', 'SPECIFIC_GROUPS').default('ALL'),
        targetGroups: Joi.when('visibility', {
            is: 'SPECIFIC_GROUPS',
            then: Joi.array().items(Joi.string().hex().length(24)).min(1).required(),
            otherwise: Joi.forbidden()
        }),
        tags: Joi.array().items(Joi.string().max(50))
    })),
    uploadMiddleware.multiple('documents', 5, {
        directory: 'course-materials',
        allowedTypes: ['application/pdf', 'image/jpeg', 'image/png', 
                      'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        maxSize: 10 * 1024 * 1024 // 10MB
    }),
    documentController.uploadCourseMaterials
);

// Upload de justificatifs d'absence
router.post('/attendance-proof',
    restrictTo(['student', 'parent']),
    validate(Joi.object({
        attendanceId: Joi.string().hex().length(24).required(),
        reason: Joi.string().required().min(10).max(500),
        type: Joi.string().valid('MEDICAL', 'FAMILY', 'OTHER').required()
    })),
    uploadMiddleware.single('proof', {
        directory: 'attendance-proofs',
        allowedTypes: ['application/pdf', 'image/jpeg', 'image/png'],
        maxSize: 5 * 1024 * 1024 // 5MB
    }),
    documentController.uploadAttendanceProof
);

// Recherche de documents
router.get('/search',
    validate(Joi.object({
        query: Joi.string().min(2).max(100),
        type: Joi.string().valid('COURSE', 'EXERCISE', 'RESOURCE', 'HOMEWORK'),
        courseId: Joi.string().hex().length(24),
        periodId: Joi.string().hex().length(24),
        page: Joi.number().min(1).default(1),
        limit: Joi.number().min(1).max(50).default(10),
        sortBy: Joi.string().valid('createdAt', 'title', 'downloadCount').default('createdAt'),
        order: Joi.string().valid('asc', 'desc').default('desc')
    }), 'query'),
    documentController.searchDocuments
);

// Téléchargement de documents
router.get('/download/:fileId',
    validate(Joi.object({
        fileId: Joi.string().hex().length(24).required()
    }), 'params'),
    documentController.downloadDocument
);

// Mise à jour de document
router.patch('/:fileId',
    restrictTo(['professor', 'admin']),
    validate(Joi.object({
        fileId: Joi.string().hex().length(24).required()
    }), 'params'),
    validate(Joi.object({
        title: Joi.string().max(200),
        description: Joi.string().max(1000),
        visibility: Joi.string().valid('ALL', 'SPECIFIC_GROUPS'),
        targetGroups: Joi.when('visibility', {
            is: 'SPECIFIC_GROUPS',
            then: Joi.array().items(Joi.string().hex().length(24)).min(1),
            otherwise: Joi.forbidden()
        }),
        tags: Joi.array().items(Joi.string().max(50)),
        status: Joi.string().valid('ACTIVE', 'ARCHIVED', 'HIDDEN'),
        order: Joi.number()
    }).min(1)),
    documentController.updateDocument
);

// Suppression de documents
router.delete('/:fileId',
    restrictTo(['professor', 'admin']),
    validate(Joi.object({
        fileId: Joi.string().hex().length(24).required()
    }), 'params'),
    documentController.deleteDocument
);

// Statistiques de document
router.get('/:fileId/stats',
    validate(Joi.object({
        fileId: Joi.string().hex().length(24).required()
    }), 'params'),
    documentController.getDocumentStats
);

module.exports = router;