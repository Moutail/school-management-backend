// src/controllers/academicController.js
const AcademicPeriod = require('../models/academicPeriodModel');
const { AppError } = require('../utils/errors');
const { catchAsync } = require('../utils/errorHandlers');
const ActivityLog = require('../models/activityLogModel');
const cache = require('../config/cache');

const academicController = {
    // Obtenir toutes les périodes
    getPeriods: catchAsync(async (req, res) => {
        const periods = await AcademicPeriod.find()
            .sort({ startDate: -1 })
            .lean();
            
        // Mise en cache des résultats
        const cacheKey = 'academic:periods';
        await cache.set(cacheKey, JSON.stringify(periods), { EX: 300 }); // 5 minutes

        res.json({
            status: 'success',
            data: periods
        });
    }),

    // Créer une nouvelle période
    createPeriod: catchAsync(async (req, res) => {
        const { startDate, endDate } = req.body;
        
        // Vérification des chevauchements
        const overlapping = await AcademicPeriod.findOne({
            $or: [
                {
                    startDate: { $lte: endDate },
                    endDate: { $gte: startDate }
                }
            ]
        });

        if (overlapping) {
            throw new AppError('Cette période chevauche une période existante', 400);
        }

        const period = await AcademicPeriod.create(req.body);

        // Log de l'activité
        await ActivityLog.logActivity({
            user: req.user._id,
            action: 'PERIOD_CREATE',
            details: period
        });
        
        // Invalidation du cache
        await cache.del('academic:periods');

        res.status(201).json({
            status: 'success',
            data: period
        });
    }),

    // Mettre à jour une période
    updatePeriod: catchAsync(async (req, res) => {
        const { id } = req.params;
        const updates = req.body;

        const period = await AcademicPeriod.findById(id);
        if (!period) {
            throw new AppError('Période non trouvée', 404);
        }

        // Vérification des chevauchements si dates modifiées
        if (updates.startDate || updates.endDate) {
            const startDate = updates.startDate || period.startDate;
            const endDate = updates.endDate || period.endDate;

            const overlapping = await AcademicPeriod.findOne({
                _id: { $ne: id },
                $or: [
                    {
                        startDate: { $lte: endDate },
                        endDate: { $gte: startDate }
                    }
                ]
            });

            if (overlapping) {
                throw new AppError('Cette période chevauche une période existante', 400);
            }
        }

        const updatedPeriod = await AcademicPeriod.findByIdAndUpdate(
            id,
            updates,
            { new: true, runValidators: true }
        );

        // Log de l'activité
        await ActivityLog.logActivity({
            user: req.user._id,
            action: 'PERIOD_UPDATE',
            details: { periodId: id, updates }
        });

        // Invalidation du cache
        await cache.del('academic:periods');

        res.json({
            status: 'success',
            data: updatedPeriod
        });
    }),

    // Supprimer une période
    deletePeriod: catchAsync(async (req, res) => {
        const { id } = req.params;

        const period = await AcademicPeriod.findById(id);
        if (!period) {
            throw new AppError('Période non trouvée', 404);
        }

        if (period.status === 'ACTIVE') {
            throw new AppError('Impossible de supprimer une période active', 400);
        }

        await AcademicPeriod.findByIdAndDelete(id);

        // Log de l'activité
        await ActivityLog.logActivity({
            user: req.user._id,
            action: 'PERIOD_DELETE',
            details: { periodId: id }
        });
        
        // Invalidation du cache
        await cache.del('academic:periods');

        res.json({
            status: 'success',
            message: 'Période supprimée avec succès'
        });
    }),

    // Générer un rapport
    generateReport: catchAsync(async (req, res) => {
        const { periodId, type, format = 'pdf' } = req.body;

        const period = await AcademicPeriod.findById(periodId);
        if (!period) {
            throw new AppError('Période non trouvée', 404);
        }

        let reportData;
        switch (type) {
            case 'ATTENDANCE':
                reportData = await generateAttendanceReport(period, format);
                break;
            case 'PERFORMANCE':
                reportData = await generatePerformanceReport(period, format);
                break;
            case 'GRADES':
                reportData = await generateGradesReport(period, format);
                break;
            default:
                throw new AppError('Type de rapport invalide', 400);
        }

        // Log de l'activité
        await ActivityLog.logActivity({
            user: req.user._id,
            action: 'REPORT_GENERATE',
            details: { periodId, type, format }
        });

        res.json({
            status: 'success',
            data: reportData
        });
    }),

    // Obtenir les rapports
    getReports: catchAsync(async (req, res) => {
        const { periodId, type, startDate, endDate } = req.query;
        const query = {};

        if (periodId) query.period = periodId;
        if (type) query.type = type;
        if (startDate && endDate) {
            query.createdAt = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }

        const reports = await AcademicPeriod.find(query)
            .populate('period', 'name')
            .sort({ createdAt: -1 })
            .lean();

        res.json({
            status: 'success',
            data: reports
        });
    }),

    // Obtenir les statistiques académiques
    getAcademicStats: catchAsync(async (req, res) => {
        const stats = await AcademicPeriod.aggregate([
            {
                $group: {
                    _id: "$status",
                    count: { $sum: 1 },
                    avgDuration: {
                        $avg: {
                            $subtract: ["$endDate", "$startDate"]
                        }
                    }
                }
            }
        ]);

        res.json({
            status: 'success',
            data: stats
        });
    }),

    // Obtenir les statistiques d'une période
    getPeriodStats: catchAsync(async (req, res) => {
        const { id } = req.params;

        const period = await AcademicPeriod.findById(id);
        if (!period) {
            throw new AppError('Période non trouvée', 404);
        }

        const stats = await AcademicPeriod.aggregate([
            {
                $match: { _id: period._id }
            },
            {
                $lookup: {
                    from: 'attendances',
                    localField: '_id',
                    foreignField: 'period',
                    as: 'attendances'
                }
            },
            {
                $lookup: {
                    from: 'grades',
                    localField: '_id',
                    foreignField: 'period',
                    as: 'grades'
                }
            },
            {
                $project: {
                    totalAttendance: { $size: '$attendances' },
                    averageGrade: { $avg: '$grades.value' },
                    duration: {
                        $divide: [
                            { $subtract: ['$endDate', '$startDate'] },
                            86400000 // Conversion en jours
                        ]
                    }
                }
            }
        ]);

        res.json({
            status: 'success',
            data: stats[0]
        });
    })
};

module.exports = academicController;