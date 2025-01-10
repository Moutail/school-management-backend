// src/routes/courseRoutes.js
const express = require('express');
const router = express.Router();
const courseController = require('../controllers/courseController'); // Assurez-vous que ce fichier existe
const { protect, restrictTo } = require('../middleware/authMiddleware'); // Assurez-vous que ce fichier existe
const { validate, schemas } = require('../middleware/validation'); // Assurez-vous que ce fichier existe
const upload = require('../utils/multer-config'); // Assurez-vous que ce fichier existe
const Joi = require('joi');

// Protection globale des routes
router.use(protect);

// Routes principales des cours
router.get('/', validate(Joi.object({
    page: Joi.number().min(1).default(1),
    limit: Joi.number().min(1).max(100).default(10),
    search: Joi.string(),
    professor: Joi.string().hex().length(24),
    period: Joi.string().hex().length(24),
    status: Joi.string().valid('active', 'archived', 'upcoming')
}), 'query'), courseController.getCourses);

router.get('/:id', validate(Joi.object({
    id: Joi.string().hex().length(24).required()
}), 'params'), courseController.getCourse);

router.post('/', restrictTo(['professor', 'admin']), validate(schemas.course), courseController.createCourse);

// Routes pour les documents
router.post('/:courseId/documents', restrictTo(['professor']), validate(Joi.object({
    courseId: Joi.string().hex().length(24).required()
}), 'params'), validate(Joi.object({
    title: Joi.string().required(),
    type: Joi.string().valid('COURSE', 'EXERCISE', 'RESOURCE', 'HOMEWORK').required(),
    chapterId: Joi.string().hex().length(24),
    periodId: Joi.string().hex().length(24).required(),
    description: Joi.string().max(500),
    visibility: Joi.string().valid('ALL', 'SPECIFIC_GROUPS').default('ALL'),
    targetGroups: Joi.when('visibility', {
        is: 'SPECIFIC_GROUPS',
        then: Joi.array().items(Joi.string().hex().length(24)).min(1).required(),
        otherwise: Joi.forbidden()
    })
})), upload.single('file'), courseController.uploadDocument);

router.get('/documents/:documentId', validate(Joi.object({
    documentId: Joi.string().hex().length(24).required()
}), 'params'), courseController.getDocumentInfo);

router.get('/documents/:documentId/download', validate(Joi.object({
    documentId: Joi.string().hex().length(24).required()
}), 'params'), courseController.downloadDocument);

router.patch('/documents/:documentId', restrictTo(['professor']), validate(Joi.object({
    documentId: Joi.string().hex().length(24).required()
}), 'params'), validate(Joi.object({
    title: Joi.string(),
    type: Joi.string().valid('COURSE', 'EXERCISE', 'RESOURCE', 'HOMEWORK'),
    description: Joi.string().max(500),
    visibility: Joi.string().valid('ALL', 'SPECIFIC_GROUPS'),
    targetGroups: Joi.when('visibility', {
        is: 'SPECIFIC_GROUPS',
        then: Joi.array().items(Joi.string().hex().length(24)).min(1),
        otherwise: Joi.forbidden()
    })
}).min(1)), courseController.updateDocument);

router.delete('/documents/:documentId', restrictTo(['professor']), validate(Joi.object({
    documentId: Joi.string().hex().length(24).required()
}), 'params'), courseController.deleteDocument);

module.exports = router;