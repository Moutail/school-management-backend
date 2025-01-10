// src/controllers/majorController.js
const mongoose = require('mongoose');
const { MajorPrivileges } = require('../models');
const Class = require('../models/classModel');
const User = require('../models/userModel');
const { AppError } = require('../utils/errors');
const { catchAsync } = require('../utils/errorHandlers');
const { createClassNotification, notifyParticipants } = require('../utils/notifications');

const majorController = {
    // Obtenir les activités
    getActivities: catchAsync(async (req, res) => {
        const { startDate, endDate, type, status } = req.query;
        const query = { user: req.user._id };

        if (type) query['activities.type'] = type;
        if (status) query['activities.status'] = status;
        if (startDate || endDate) {
            query['activities.deadline'] = {};
            if (startDate) query['activities.deadline'].$gte = new Date(startDate);
            if (endDate) query['activities.deadline'].$lte = new Date(endDate);
        }

        const major = await MajorPrivileges.findOne(query)
            .populate('activities.participants', 'firstName lastName');

        res.status(200).json({
            status: 'success',
            data: {
                activities: major ? major.activities : []
            }
        });
    }),

    // Créer une activité
    createActivity: catchAsync(async (req, res) => {
        const major = await MajorPrivileges.findOne({ user: req.user._id });
        if (!major) {
            throw new AppError('Privilèges de major non trouvés', 404);
        }

        if (req.body.participants) {
            const students = await User.find({
                _id: { $in: req.body.participants },
                class: req.user.class
            });

            if (students.length !== req.body.participants.length) {
                throw new AppError('Un ou plusieurs participants sont invalides', 400);
            }
        }

        major.activities.push({
            ...req.body,
            status: 'PENDING'
        });

        await major.save();

        const newActivity = major.activities[major.activities.length - 1];

        if (req.body.participants) {
            await notifyParticipants(req.body.participants, {
                type: 'NEW_ACTIVITY',
                activity: newActivity
            });
        } else {
            await createClassNotification(req.user.class, {
                type: 'NEW_ACTIVITY',
                activity: newActivity
            });
        }

        res.status(201).json({
            status: 'success',
            data: { activity: newActivity }
        });
    }),

    // Mettre à jour une activité
    updateActivity: catchAsync(async (req, res) => {
        const result = await MajorPrivileges.findOneAndUpdate(
            {
                user: req.user._id,
                'activities._id': req.params.id
            },
            {
                $set: {
                    'activities.$': {
                        ...req.body,
                        _id: req.params.id,
                        updatedAt: new Date()
                    }
                }
            },
            { new: true }
        ).populate('activities.participants', 'firstName lastName');

        if (!result) {
            throw new AppError('Activité non trouvée', 404);
        }

        const updatedActivity = result.activities.id(req.params.id);

        if (updatedActivity.participants?.length > 0) {
            await notifyParticipants(updatedActivity.participants.map(p => p._id), {
                type: 'ACTIVITY_UPDATED',
                activity: updatedActivity
            });
        } else {
            await createClassNotification(req.user.class, {
                type: 'ACTIVITY_UPDATED',
                activity: updatedActivity
            });
        }

        res.status(200).json({
            status: 'success',
            data: { activity: updatedActivity }
        });
    }),

    // Supprimer une activité
    deleteActivity: catchAsync(async (req, res) => {
        const result = await MajorPrivileges.findOneAndUpdate(
            {
                user: req.user._id,
                'activities._id': req.params.id
            },
            {
                $pull: { activities: { _id: req.params.id } }
            },
            { new: true }
        );

        if (!result) {
            throw new AppError('Activité non trouvée', 404);
        }

        res.status(200).json({
            status: 'success',
            message: 'Activité supprimée avec succès'
        });
    }),

    // Obtenir les statistiques de la classe
    getClassStats: catchAsync(async (req, res) => {
        const stats = await Class.aggregate([
            {
                $match: { _id: mongoose.Types.ObjectId(req.user.class) }
            },
            {
                $lookup: {
                    from: 'attendances',
                    localField: 'students',
                    foreignField: 'student',
                    as: 'attendances'
                }
            },
            {
                $lookup: {
                    from: 'grades',
                    localField: 'students',
                    foreignField: 'student',
                    as: 'grades'
                }
            },
            {
                $project: {
                    averageAttendance: {
                        $multiply: [
                            { $divide: [{ $size: '$attendances' }, { $size: '$students' }] },
                            100
                        ]
                    },
                    averageGrade: { $avg: '$grades.value' }
                }
            }
        ]);

        res.status(200).json({
            status: 'success',
            data: { stats: stats[0] }
        });
    }),

    // Obtenir les statistiques de présence
    getAttendanceStats: catchAsync(async (req, res) => {
        const { startDate, endDate, course } = req.query;
        const matchQuery = { class: mongoose.Types.ObjectId(req.user.class) };

        if (startDate || endDate) {
            matchQuery.date = {};
            if (startDate) matchQuery.date.$gte = new Date(startDate);
            if (endDate) matchQuery.date.$lte = new Date(endDate);
        }
        if (course) matchQuery.course = mongoose.Types.ObjectId(course);

        const stats = await Class.aggregate([
            {
                $match: { _id: mongoose.Types.ObjectId(req.user.class) }
            },
            {
                $lookup: {
                    from: 'attendances',
                    let: { classId: '$_id' },
                    pipeline: [
                        {
                            $match: {
                                $expr: { $eq: ['$class', '$$classId'] },
                                ...matchQuery
                            }
                        }
                    ],
                    as: 'attendanceRecords'
                }
            },
            {
                $project: {
                    totalSessions: { $size: '$attendanceRecords' },
                    present: {
                        $size: {
                            $filter: {
                                input: '$attendanceRecords',
                                as: 'record',
                                cond: { $eq: ['$$record.status', 'PRESENT'] }
                            }
                        }
                    },
                    absent: {
                        $size: {
                            $filter: {
                                input: '$attendanceRecords',
                                as: 'record',
                                cond: { $eq: ['$$record.status', 'ABSENT'] }
                            }
                        }
                    },
                    late: {
                        $size: {
                            $filter: {
                                input: '$attendanceRecords',
                                as: 'record',
                                cond: { $eq: ['$$record.status', 'LATE'] }
                            }
                        }
                    }
                }
            }
        ]);

        res.status(200).json({
            status: 'success',
            data: { stats: stats[0] }
        });
    }),

    // Obtenir les statistiques de performance
    getPerformanceStats: catchAsync(async (req, res) => {
        const { period, course } = req.query;
        const query = { class: mongoose.Types.ObjectId(req.user.class) };

        if (period) query.academicPeriod = mongoose.Types.ObjectId(period);
        if (course) query.course = mongoose.Types.ObjectId(course);

        const stats = await Class.aggregate([
            {
                $match: { _id: mongoose.Types.ObjectId(req.user.class) }
            },
            {
                $lookup: {
                    from: 'grades',
                    let: { classId: '$_id' },
                    pipeline: [
                        {
                            $match: {
                                $expr: { $eq: ['$class', '$$classId'] },
                                ...query
                            }
                        }
                    ],
                    as: 'grades'
                }
            },
            {
                $project: {
                    averageGrade: { $avg: '$grades.value' },
                    maxGrade: { $max: '$grades.value' },
                    minGrade: { $min: '$grades.value' },
                    distribution: {
                        excellent: {
                            $size: {
                                $filter: {
                                    input: '$grades',
                                    as: 'grade',
                                    cond: { $gte: ['$$grade.value', 16] }
                                }
                            }
                        },
                        good: {
                            $size: {
                                $filter: {
                                    input: '$grades',
                                    as: 'grade',
                                    cond: {
                                        $and: [
                                            { $gte: ['$$grade.value', 14] },
                                            { $lt: ['$$grade.value', 16] }
                                        ]
                                    }
                                }
                            }
                        },
                        average: {
                            $size: {
                                $filter: {
                                    input: '$grades',
                                    as: 'grade',
                                    cond: {
                                        $and: [
                                            { $gte: ['$$grade.value', 12] },
                                            { $lt: ['$$grade.value', 14] }
                                        ]
                                    }
                                }
                            }
                        },
                        belowAverage: {
                            $size: {
                                $filter: {
                                    input: '$grades',
                                    as: 'grade',
                                    cond: { $lt: ['$$grade.value', 12] }
                                }
                            }
                        }
                    },
                    totalStudents: { $size: '$students' }
                }
            }
        ]);

        res.status(200).json({
            status: 'success',
            data: {
                stats: stats[0] || {
                    averageGrade: 0,
                    maxGrade: 0,
                    minGrade: 0,
                    distribution: {
                        excellent: 0,
                        good: 0,
                        average: 0,
                        belowAverage: 0
                    },
                    totalStudents: 0
                }
            }
        });
    }),

    // Obtenir les alertes
    getAlerts: catchAsync(async (req, res) => {
        const { status, priority, startDate, endDate } = req.query;
        const query = { user: req.user._id };

        if (status) query['alerts.status'] = status;
        if (priority) query['alerts.priority'] = priority;
        if (startDate || endDate) {
            query['alerts.createdAt'] = {};
            if (startDate) query['alerts.createdAt'].$gte = new Date(startDate);
            if (endDate) query['alerts.createdAt'].$lte = new Date(endDate);
        }

        const major = await MajorPrivileges.findOne(query)
            .populate('alerts.targetUsers', 'firstName lastName');

        res.status(200).json({
            status: 'success',
            data: { alerts: major ? major.alerts : [] }
        });
    }),

    // Créer une alerte
    createAlert: catchAsync(async (req, res) => {
        const major = await MajorPrivileges.findOne({ user: req.user._id });
        if (!major) {
            throw new AppError('Privilèges de major non trouvés', 404);
        }

        const alert = {
            ...req.body,
            status: 'ACTIVE',
            createdAt: new Date()
        };

        major.alerts.push(alert);
        await major.save();

        const newAlert = major.alerts[major.alerts.length - 1];

        if (req.body.targetUsers?.length > 0) {
            await notifyParticipants(req.body.targetUsers, {
                type: 'NEW_ALERT',
                alert: newAlert
            });
        } else {
            await createClassNotification(req.user.class, {
                type: 'NEW_ALERT',
                alert: newAlert
            });
        }

        res.status(201).json({
            status: 'success',
            data: { alert: newAlert }
        });
    }),

    // Mettre à jour une alerte
    updateAlert: catchAsync(async (req, res) => {
        const result = await MajorPrivileges.findOneAndUpdate(
            {
                user: req.user._id,
                'alerts._id': req.params.id
            },
            {
                $set: {
                    'alerts.$': {
                        ...req.body,
                        _id: req.params.id,
                        updatedAt: new Date()
                    }
                }
            },
            { new: true }
        ).populate('alerts.targetUsers', 'firstName lastName');

        if (!result) {
            throw new AppError('Alerte non trouvée', 404);
        }

        const updatedAlert = result.alerts.id(req.params.id);

        if (updatedAlert.status === 'RESOLVED' || updatedAlert.status === 'DISMISSED') {
            await createClassNotification(req.user.class, {
                type: 'ALERT_STATUS_CHANGED',
                alert: updatedAlert
            });
        }

        res.status(200).json({
            status: 'success',
            data: { alert: updatedAlert }
        });
    })
};

module.exports = majorController;