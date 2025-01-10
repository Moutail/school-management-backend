// src/controllers/adminController.js
const User = require('../models/userModel');
const Tuition = require('../models/tuitionModel');
const { AppError } = require('../utils/errors');
const { catchAsync } = require('../utils/errorHandlers');

const adminController = {
    /**
     * Accorder des privilèges administratifs
     */
    grantAdminPrivilege: catchAsync(async (req, res) => {
        const { userId, role, permissions } = req.body;

        const user = await User.findByIdAndUpdate(
            userId,
            { role, permissions },
            { new: true, runValidators: true }
        );

        if (!user) {
            throw new AppError('Utilisateur non trouvé', 404);
        }

        res.status(200).json({
            status: 'success',
            data: { user }
        });
    }),

    /**
     * Récupérer les privilèges administratifs
     */
    getAdminPrivileges: catchAsync(async (req, res) => {
        const { role, userId } = req.query;
        const query = {};

        if (role) query.role = role;
        if (userId) query._id = userId;

        const users = await User.find(query).select('role permissions');

        res.status(200).json({
            status: 'success',
            data: { users }
        });
    }),

    /**
     * Mettre à jour le statut d'un étudiant
     */
    updateStudentStatus: catchAsync(async (req, res) => {
        const { studentId } = req.params;
        const { isBlocked, reason, duration } = req.body;

        const user = await User.findByIdAndUpdate(
            studentId,
            {
                isBlocked,
                blockReason: reason,
                blockEndDate: isBlocked ? new Date(Date.now() + duration * 24 * 60 * 60 * 1000) : null
            },
            { new: true, runValidators: true }
        );

        if (!user) {
            throw new AppError('Étudiant non trouvé', 404);
        }

        res.status(200).json({
            status: 'success',
            data: { user }
        });
    }),

    /**
     * Mettre à jour les informations d'un étudiant
     */
    updateStudentInfo: catchAsync(async (req, res) => {
        const { studentId } = req.params;
        const updates = req.body;

        const user = await User.findByIdAndUpdate(
            studentId,
            updates,
            { new: true, runValidators: true }
        );

        if (!user) {
            throw new AppError('Étudiant non trouvé', 404);
        }

        res.status(200).json({
            status: 'success',
            data: { user }
        });
    }),

    /**
     * Récupérer le solde des frais de scolarité d'un étudiant
     */
    getTuitionBalance: catchAsync(async (req, res) => {
        const { studentId } = req.params;

        const tuition = await Tuition.findOne({ student: studentId });

        if (!tuition) {
            throw new AppError('Aucun enregistrement de frais de scolarité trouvé', 404);
        }

        res.status(200).json({
            status: 'success',
            data: { tuition }
        });
    }),

    /**
     * Enregistrer un paiement de frais de scolarité
     */
    recordTuitionPayment: catchAsync(async (req, res) => {
        const { studentId, amount, paymentMethod, description, academicYear } = req.body;

        const tuition = await Tuition.findOneAndUpdate(
            { student: studentId },
            {
                $push: {
                    payments: {
                        amount,
                        paymentMethod,
                        description,
                        academicYear
                    }
                }
            },
            { new: true, runValidators: true }
        );

        if (!tuition) {
            throw new AppError('Aucun enregistrement de frais de scolarité trouvé', 404);
        }

        res.status(200).json({
            status: 'success',
            data: { tuition }
        });
    }),

    /**
     * Récupérer les statistiques des étudiants
     */
    getStudentStats: catchAsync(async (req, res) => {
        const { startDate, endDate, status, class: classId } = req.query;

        const stats = await User.aggregate([
            {
                $match: {
                    role: 'student',
                    ...(status && { status }),
                    ...(classId && { class: classId }),
                    ...(startDate && endDate && {
                        createdAt: { $gte: new Date(startDate), $lte: new Date(endDate) }
                    })
                }
            },
            {
                $group: {
                    _id: null,
                    totalStudents: { $sum: 1 },
                    activeStudents: { $sum: { $cond: [{ $eq: ['$isBlocked', false] }, 1, 0] } },
                    blockedStudents: { $sum: { $cond: [{ $eq: ['$isBlocked', true] }, 1, 0] } }
                }
            }
        ]);

        res.status(200).json({
            status: 'success',
            data: { stats: stats[0] || {} }
        });
    }),

    /**
     * Récupérer les statistiques des frais de scolarité
     */
    getTuitionStats: catchAsync(async (req, res) => {
        const { academicYear, status, class: classId } = req.query;

        const stats = await Tuition.aggregate([
            {
                $match: {
                    ...(academicYear && { academicYear }),
                    ...(status && { status }),
                    ...(classId && { class: classId })
                }
            },
            {
                $group: {
                    _id: null,
                    totalTuition: { $sum: '$amount' },
                    totalPaid: { $sum: '$payments.amount' },
                    totalPending: { $sum: { $subtract: ['$amount', { $sum: '$payments.amount' }] } }
                }
            }
        ]);

        res.status(200).json({
            status: 'success',
            data: { stats: stats[0] || {} }
        });
    }),

    /**
     * Récupérer les paramètres système
     */
    getSystemSettings: catchAsync(async (req, res) => {
        // Implémentez la logique pour récupérer les paramètres système
        const settings = {}; // Remplacez par votre logique

        res.status(200).json({
            status: 'success',
            data: { settings }
        });
    }),

    /**
     * Mettre à jour les paramètres système
     */
    updateSystemSettings: catchAsync(async (req, res) => {
        // Implémentez la logique pour mettre à jour les paramètres système
        const updatedSettings = {}; // Remplacez par votre logique

        res.status(200).json({
            status: 'success',
            data: { settings: updatedSettings }
        });
    })
};

module.exports = adminController;