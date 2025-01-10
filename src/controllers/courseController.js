// src/controllers/courseController.js
const Course = require('../models/courseModel');
const Document = require('../models/documentModel');
const { AppError } = require('../utils/errors');
const { catchAsync } = require('../utils/errorHandlers');

const courseController = {
    /**
     * Récupérer tous les cours
     */
    getCourses: catchAsync(async (req, res) => {
        const { page = 1, limit = 10, search, professor, period, status } = req.query;

        const query = {};
        if (search) query.title = { $regex: search, $options: 'i' };
        if (professor) query.professor = professor;
        if (period) query.period = period;
        if (status) query.status = status;

        const courses = await Course.find(query)
            .skip((page - 1) * limit)
            .limit(limit)
            .populate('professor', 'firstName lastName')
            .populate('period', 'name');

        const total = await Course.countDocuments(query);

        res.status(200).json({
            status: 'success',
            data: {
                courses,
                pagination: {
                    total,
                    pages: Math.ceil(total / limit),
                    page: Number(page),
                    limit: Number(limit)
                }
            }
        });
    }),

    /**
     * Récupérer un cours par ID
     */
    getCourse: catchAsync(async (req, res) => {
        const course = await Course.findById(req.params.id)
            .populate('professor', 'firstName lastName')
            .populate('period', 'name');

        if (!course) {
            throw new AppError('Cours non trouvé', 404);
        }

        res.status(200).json({
            status: 'success',
            data: { course }
        });
    }),

    /**
     * Créer un nouveau cours
     */
    createCourse: catchAsync(async (req, res) => {
        const course = await Course.create(req.body);

        res.status(201).json({
            status: 'success',
            data: { course }
        });
    }),

    /**
     * Téléverser un document pour un cours
     */
    uploadDocument: catchAsync(async (req, res) => {
        const { courseId } = req.params;
        const { title, type, chapterId, periodId, description, visibility, targetGroups } = req.body;

        const document = await Document.create({
            title,
            type,
            chapter: chapterId,
            period: periodId,
            description,
            visibility,
            targetGroups,
            file: req.file.path // Chemin du fichier téléversé
        });

        await Course.findByIdAndUpdate(courseId, {
            $push: { documents: document._id }
        });

        res.status(201).json({
            status: 'success',
            data: { document }
        });
    }),

    /**
     * Récupérer les informations d'un document
     */
    getDocumentInfo: catchAsync(async (req, res) => {
        const document = await Document.findById(req.params.documentId);

        if (!document) {
            throw new AppError('Document non trouvé', 404);
        }

        res.status(200).json({
            status: 'success',
            data: { document }
        });
    }),

    /**
     * Télécharger un document
     */
    downloadDocument: catchAsync(async (req, res) => {
        const document = await Document.findById(req.params.documentId);

        if (!document) {
            throw new AppError('Document non trouvé', 404);
        }

        res.download(document.file); // Télécharger le fichier
    }),

    /**
     * Mettre à jour un document
     */
    updateDocument: catchAsync(async (req, res) => {
        const document = await Document.findByIdAndUpdate(
            req.params.documentId,
            req.body,
            { new: true, runValidators: true }
        );

        if (!document) {
            throw new AppError('Document non trouvé', 404);
        }

        res.status(200).json({
            status: 'success',
            data: { document }
        });
    }),

    /**
     * Supprimer un document
     */
    deleteDocument: catchAsync(async (req, res) => {
        const document = await Document.findByIdAndDelete(req.params.documentId);

        if (!document) {
            throw new AppError('Document non trouvé', 404);
        }

        res.status(204).json({
            status: 'success',
            data: null
        });
    })
};

module.exports = courseController;