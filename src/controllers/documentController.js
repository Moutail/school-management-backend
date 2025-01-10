// src/controllers/documentController.js
const Document = require('../models/documentModel');
const Attendance = require('../models/attendanceModel');
const Course = require('../models/courseModel');
const fileService = require('../services/fileService');
const AppError = require('../utils/errors').AppError;
const { catchAsync } = require('../utils/errorHandlers');

const documentController = {
    uploadCourseMaterials: catchAsync(async (req, res) => {
        const {
            courseId,
            periodId,
            chapterId,
            type,
            title,
            description,
            visibility,
            targetGroups,
            tags
        } = req.body;

        // Vérifier les permissions du cours
        const course = await Course.findById(courseId);
        if (!course) {
            throw new AppError('Cours non trouvé', 404);
        }
        if (course.professor.toString() !== req.user._id.toString()) {
            throw new AppError('Vous n\'êtes pas autorisé à uploader des documents pour ce cours', 403);
        }

        const uploadedDocs = await Promise.all(req.files.map(async file => {
            const document = new Document({
                title: title || file.originalname,
                type,
                file: file.path,
                course: courseId,
                chapter: chapterId,
                academicPeriod: periodId,
                uploadedBy: req.user._id,
                description,
                visibility,
                targetGroups: visibility === 'SPECIFIC_GROUPS' ? targetGroups : undefined,
                tags,
                metadata: {
                    size: file.size,
                    mimeType: file.mimetype,
                    originalName: file.originalname,
                    extension: file.originalname.split('.').pop()
                }
            });

            await document.save();
            return document;
        }));

        res.status(201).json({
            status: 'success',
            data: {
                documents: uploadedDocs
            }
        });
    }),

    uploadAttendanceProof: catchAsync(async (req, res) => {
        const { attendanceId, reason, type } = req.body;

        // Vérifier l'enregistrement de présence
        const attendance = await Attendance.findById(attendanceId);
        if (!attendance) {
            throw new AppError('Enregistrement de présence non trouvé', 404);
        }

        // Vérifier les permissions
        if (req.user.role === 'student' && attendance.student.toString() !== req.user._id.toString()) {
            throw new AppError('Vous n\'êtes pas autorisé à soumettre ce justificatif', 403);
        }
        if (req.user.role === 'parent' && !req.user.children.includes(attendance.student)) {
            throw new AppError('Vous n\'êtes pas autorisé à soumettre ce justificatif', 403);
        }

        const document = await Document.create({
            title: `Justificatif - ${type} - ${new Date().toLocaleDateString()}`,
            type: 'ATTENDANCE_PROOF',
            file: req.file.path,
            uploadedBy: req.user._id,
            metadata: {
                size: req.file.size,
                mimeType: req.file.mimetype,
                originalName: req.file.originalname,
                extension: req.file.originalname.split('.').pop()
            }
        });

        // Mettre à jour l'enregistrement de présence
        attendance.justification = {
            document: document._id,
            reason,
            type,
            submittedAt: new Date(),
            status: 'PENDING'
        };
        await attendance.save();

        res.status(201).json({
            status: 'success',
            data: {
                document,
                attendance
            }
        });
    }),

    searchDocuments: catchAsync(async (req, res) => {
        const {
            query,
            type,
            courseId,
            periodId,
            page,
            limit,
            sortBy,
            order
        } = req.query;

        const searchQuery = {};

        if (query) {
            searchQuery.$text = { $search: query };
        }
        if (type) searchQuery.type = type;
        if (courseId) searchQuery.course = courseId;
        if (periodId) searchQuery.academicPeriod = periodId;

        // Ajouter les restrictions d'accès selon le rôle
        if (req.user.role === 'student') {
            searchQuery.$or = [
                { visibility: 'ALL' },
                {
                    visibility: 'SPECIFIC_GROUPS',
                    targetGroups: { $in: req.user.groups }
                }
            ];
        }

        const documents = await Document.find(searchQuery)
            .sort({ [sortBy]: order === 'desc' ? -1 : 1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .populate('uploadedBy', 'firstName lastName')
            .populate('course', 'title code');

        const total = await Document.countDocuments(searchQuery);

        res.status(200).json({
            status: 'success',
            data: {
                documents,
                pagination: {
                    total,
                    page,
                    pages: Math.ceil(total / limit)
                }
            }
        });
    }),

    downloadDocument: catchAsync(async (req, res) => {
        const { fileId } = req.params;
        const document = await Document.findById(fileId);
        
        if (!document) {
            throw new AppError('Document non trouvé', 404);
        }

        // Vérifier l'accès
        if (!document.isAccessibleBy(req.user)) {
            throw new AppError('Vous n\'avez pas accès à ce document', 403);
        }

        const fileStream = await fileService.getFileStream(document.file);

        // Enregistrer le téléchargement
        await document.addDownload(req.user, {
            ip: req.ip,
            userAgent: req.get('user-agent')
        });

        res.setHeader('Content-Type', document.metadata.mimeType);
        res.setHeader('Content-Disposition', `attachment; filename="${document.metadata.originalName}"`);
        res.setHeader('Content-Length', document.metadata.size);

        fileStream.pipe(res);
    }),

    updateDocument: catchAsync(async (req, res) => {
        const { fileId } = req.params;
        const updateData = req.body;

        const document = await Document.findById(fileId);
        if (!document) {
            throw new AppError('Document non trouvé', 404);
        }

        // Vérifier les permissions
        const course = await Course.findById(document.course);
        if (course.professor.toString() !== req.user._id.toString()) {
            throw new AppError('Vous n\'êtes pas autorisé à modifier ce document', 403);
        }

        const updatedDocument = await Document.findByIdAndUpdate(
            fileId,
            updateData,
            { new: true, runValidators: true }
        );

        res.status(200).json({
            status: 'success',
            data: {
                document: updatedDocument
            }
        });
    }),

    deleteDocument: catchAsync(async (req, res) => {
        const { fileId } = req.params;
        const document = await Document.findById(fileId);

        if (!document) {
            throw new AppError('Document non trouvé', 404);
        }

        // Vérifier les permissions
        if (req.user.role !== 'admin') {
            const course = await Course.findById(document.course);
            if (course.professor.toString() !== req.user._id.toString()) {
                throw new AppError('Vous n\'êtes pas autorisé à supprimer ce document', 403);
            }
        }

        // Supprimer le fichier
        await fileService.deleteFile(document.file);
        await document.remove();

        res.status(200).json({
            status: 'success',
            message: 'Document supprimé avec succès'
        });
    }),

    getDocumentStats: catchAsync(async (req, res) => {
        const { fileId } = req.params;
        const document = await Document.findById(fileId)
            .populate({
                path: 'downloads.user',
                select: 'firstName lastName'
            });

        if (!document) {
            throw new AppError('Document non trouvé', 404);
        }

        const stats = {
            totalDownloads: document.downloadCount,
            uniqueUsers: new Set(document.downloads.map(d => d.user._id.toString())).size,
            lastDownload: document.lastDownloadedAt,
            downloadsByDay: await Document.aggregate([
                { $match: { _id: document._id } },
                { $unwind: '$downloads' },
                {
                    $group: {
                        _id: {
                            $dateToString: {
                                format: '%Y-%m-%d',
                                date: '$downloads.downloadedAt'
                            }
                        },
                        count: { $sum: 1 }
                    }
                },
                { $sort: { _id: 1 } }
            ])
        };

        res.status(200).json({
            status: 'success',
            data: {
                stats
            }
        });
    }),

    // Méthode pour obtenir les documents récents d'un cours
    getRecentDocuments: catchAsync(async (req, res) => {
        const { courseId } = req.params;
        const documents = await Document.find({
            course: courseId,
            status: 'ACTIVE',
            $or: [
                { visibility: 'ALL' },
                {
                    visibility: 'SPECIFIC_GROUPS',
                    targetGroups: { $in: req.user.groups }
                }
            ]
        })
        .sort({ createdAt: -1 })
        .limit(10)
        .populate('uploadedBy', 'firstName lastName');

        res.status(200).json({
            status: 'success',
            data: {
                documents
            }
        });
    }),

    // Méthode pour obtenir tous les documents d'un chapitre
    getChapterDocuments: catchAsync(async (req, res) => {
        const { chapterId } = req.params;
        const documents = await Document.find({
            chapter: chapterId,
            status: 'ACTIVE'
        })
        .sort({ order: 1, createdAt: -1 })
        .populate('uploadedBy', 'firstName lastName');

        res.status(200).json({
            status: 'success',
            data: {
                documents
            }
        });
    })
};

module.exports = documentController;