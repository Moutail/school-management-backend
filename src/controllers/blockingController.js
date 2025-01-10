// src/controllers/blockingController.js
const User = require('../models/userModel');
const BlockingHistory = require('../models/blockingHistoryModel');
const AppError = require('../utils/errors').AppError;
const { catchAsync } = require('../utils/errorHandlers');

const blockingController = {
    toggleBlock: catchAsync(async (req, res) => {
        const { studentId } = req.params;
        const { reason, duration, notify } = req.body;

        const student = await User.findOne({ 
            _id: studentId,
            role: 'student'
        });
        
        if (!student) {
            throw new AppError('Étudiant non trouvé', 404);
        }

        // Calculer la date de fin du blocage si une durée est spécifiée
        const blockEndDate = duration 
            ? new Date(Date.now() + duration * 24 * 60 * 60 * 1000)
            : null;

        // Mettre à jour le statut de blocage
        student.isBlocked = !student.isBlocked;
        student.blockEndDate = blockEndDate;
        await student.save();

        // Enregistrer l'action dans l'historique
        await BlockingHistory.create({
            student: studentId,
            action: student.isBlocked ? 'BLOCK' : 'UNBLOCK',
            reason,
            performedBy: req.user._id,
            duration: duration || null,
            blockEndDate
        });

        // Envoyer une notification si demandé
        if (notify) {
            try {
                await notifyBlockingStatus(student, {
                    isBlocked: student.isBlocked,
                    reason,
                    duration,
                    blockEndDate
                });
            } catch (error) {
                console.error('Erreur lors de l\'envoi de la notification:', error);
            }
        }

        res.status(200).json({
            status: 'success',
            data: {
                id: student._id,
                isBlocked: student.isBlocked,
                blockEndDate: student.blockEndDate,
                message: student.isBlocked ? 'Étudiant bloqué' : 'Étudiant débloqué'
            }
        });
    }),

    getBlockedStudents: catchAsync(async (req, res) => {
        const {
            page = 1,
            limit = 10,
            sortBy = 'blockedAt',
            order = 'desc',
            class: classId,
            search
        } = req.query;

        // Construire la requête
        const query = {
            role: 'student',
            isBlocked: true
        };

        if (classId) {
            query.class = classId;
        }

        if (search) {
            query.$or = [
                { firstName: { $regex: search, $options: 'i' } },
                { lastName: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } }
            ];
        }

        // Exécuter la requête avec pagination
        const blockedStudents = await User.find(query)
            .select('-password')
            .populate('class', 'name')
            .sort({ [sortBy]: order === 'desc' ? -1 : 1 })
            .skip((page - 1) * limit)
            .limit(limit);

        // Obtenir le nombre total pour la pagination
        const total = await User.countDocuments(query);

        res.status(200).json({
            status: 'success',
            data: {
                results: blockedStudents.length,
                total,
                totalPages: Math.ceil(total / limit),
                currentPage: page,
                students: blockedStudents
            }
        });
    }),

    getBlockingHistory: catchAsync(async (req, res) => {
        const { studentId } = req.params;

        // Vérifier que l'étudiant existe
        const student = await User.findOne({
            _id: studentId,
            role: 'student'
        });

        if (!student) {
            throw new AppError('Étudiant non trouvé', 404);
        }

        // Récupérer l'historique des blocages
        const history = await BlockingHistory.find({ student: studentId })
            .populate('performedBy', 'firstName lastName')
            .sort({ createdAt: -1 });

        res.status(200).json({
            status: 'success',
            data: {
                student: {
                    id: student._id,
                    name: `${student.firstName} ${student.lastName}`,
                    isCurrentlyBlocked: student.isBlocked,
                    blockEndDate: student.blockEndDate
                },
                history
            }
        });
    }),

    unblockStudent: catchAsync(async (req, res) => {
        const { studentId } = req.params;
        const { reason, notify } = req.body;

        const student = await User.findOne({
            _id: studentId,
            role: 'student',
            isBlocked: true
        });

        if (!student) {
            throw new AppError('Étudiant non trouvé ou déjà débloqué', 404);
        }

        // Débloquer l'étudiant
        student.isBlocked = false;
        student.blockEndDate = null;
        await student.save();

        // Enregistrer l'action
        await BlockingHistory.create({
            student: studentId,
            action: 'UNBLOCK',
            reason,
            performedBy: req.user._id
        });

        // Envoyer une notification si demandé
        if (notify) {
            try {
                await notifyBlockingStatus(student, {
                    isBlocked: false,
                    reason
                });
            } catch (error) {
                console.error('Erreur lors de l\'envoi de la notification:', error);
            }
        }

        res.status(200).json({
            status: 'success',
            message: 'Étudiant débloqué avec succès',
            data: {
                id: student._id,
                isBlocked: false
            }
        });
    })
};

// Fonction utilitaire pour envoyer les notifications
async function notifyBlockingStatus(student, details) {
    // Implémentation de la notification (email, SMS, etc.)
    // À implémenter selon vos besoins
}

module.exports = blockingController;