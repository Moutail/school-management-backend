// src/routes/attendanceRoutes.js
const express = require('express');
const router = express.Router();
const { validate } = require('../middleware/validation');
const { protect } = require('../middleware/authMiddleware');
const checkRole = require('../middleware/roleMiddleware');
const attendanceController = require('../controllers/attendanceController');
const { catchAsync } = require('../utils/errorHandlers');
const Joi = require('joi');

// Validation Schemas
const schemas = {
    create: Joi.object({
        studentId: Joi.string().hex().length(24).required(),
        courseId: Joi.string().hex().length(24).required(),
        date: Joi.date().iso().required(),
        status: Joi.string().valid('PRESENT', 'ABSENT', 'LATE', 'EXCUSED').required(),
        note: Joi.string().max(500)
    }),

    bulkCreate: Joi.object({
        courseId: Joi.string().hex().length(24).required(),
        date: Joi.date().iso().required(),
        attendances: Joi.array().items(Joi.object({
            studentId: Joi.string().hex().length(24).required(),
            status: Joi.string().valid('PRESENT', 'ABSENT', 'LATE', 'EXCUSED').required(),
            note: Joi.string().max(500)
        })).min(1).required()
    }),

    update: Joi.object({
        status: Joi.string().valid('PRESENT', 'ABSENT', 'LATE', 'EXCUSED'),
        note: Joi.string().max(500)
    }).min(1),

    justification: Joi.object({
        reason: Joi.string().required(),
        document: Joi.string().uri(),
        description: Joi.string().max(1000)
    }),

    query: Joi.object({
        courseId: Joi.string().hex().length(24),
        studentId: Joi.string().hex().length(24),
        startDate: Joi.date().iso(),
        endDate: Joi.date().iso(),
        status: Joi.string().valid('PRESENT', 'ABSENT', 'LATE', 'EXCUSED'),
        page: Joi.number().integer().min(1),
        limit: Joi.number().integer().min(1).max(100)
    })
};

// Middlewares spécifiques
const validateDates = catchAsync(async (req, res, next) => {
    if (req.body.date && new Date(req.body.date) > new Date()) {
        return res.status(400).json({
            status: 'error',
            message: 'La date ne peut pas être dans le futur'
        });
    }
    next();
});

// Routes protégées
router.use(protect);

// Routes principales
router.get('/',
    checkRole(['admin', 'professor']),
    validate(schemas.query, 'query'),
    attendanceController.getAttendances
);

router.post('/',
    checkRole(['professor', 'admin']),
    validate(schemas.create),
    validateDates,
    attendanceController.createAttendance
);

router.post('/bulk',
    checkRole(['professor', 'admin']),
    validate(schemas.bulkCreate),
    validateDates,
    attendanceController.createBulkAttendance
);

// Routes pour les rapports et statistiques
router.get('/reports/course/:courseId',
    checkRole(['admin', 'professor']),
    attendanceController.getCourseReport
);

router.get('/reports/student/:studentId',
    checkRole(['admin', 'professor', 'student', 'parent']),
    attendanceController.getStudentReport
);

router.get('/stats',
    checkRole(['admin']),
    attendanceController.getGlobalStats
);

// Routes pour les justificatifs
router.post('/:id/justification',
    checkRole(['student', 'parent']),
    validate(schemas.justification),
    attendanceController.submitJustification
);

router.patch('/:id/justification',
    checkRole(['admin', 'professor']),
    attendanceController.handleJustification
);

// Route pour obtenir les présences d'aujourd'hui
router.get('/today',
    checkRole(['admin', 'professor']),
    attendanceController.getTodayAttendance
);

// Routes avec paramètres
router.route('/:id')
    .get(
        checkRole(['admin', 'professor', 'student', 'parent']),
        attendanceController.getAttendance
    )
    .patch(
        checkRole(['admin', 'professor']),
        validate(schemas.update),
        attendanceController.updateAttendance
    )
    .delete(
        checkRole(['admin']),
        attendanceController.deleteAttendance
    );

module.exports = router;