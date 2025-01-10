// src/controllers/attendanceController.js
const Attendance = require('../models/attendanceModel');
const Course = require('../models/courseModel');
const User = require('../models/userModel');
const { AppError } = require('../utils/errors');
const { catchAsync } = require('../utils/errorHandlers');
const mongoose = require('mongoose');

const attendanceController = {
    // Obtenir les présences
    getAttendances: catchAsync(async (req, res) => {
        const { courseId, studentId, startDate, endDate, status, page = 1, limit = 10 } = req.query;
        const query = {};

        if (courseId) query.courseId = courseId;
        if (studentId) query.studentId = studentId;
        if (status) query.status = status;
        if (startDate || endDate) {
            query.date = {};
            if (startDate) query.date.$gte = new Date(startDate);
            if (endDate) query.date.$lte = new Date(endDate);
        }

        const skip = (page - 1) * limit;
        const attendances = await Attendance.find(query)
            .populate('studentId', 'firstName lastName email')
            .populate('courseId', 'name code')
            .sort('-date')
            .skip(skip)
            .limit(parseInt(limit));

        const total = await Attendance.countDocuments(query);

        res.status(200).json({
            status: 'success',
            data: {
                attendances,
                total,
                page: parseInt(page),
                pages: Math.ceil(total / limit)
            }
        });
    }),

    // Obtenir une présence spécifique
    getAttendance: catchAsync(async (req, res) => {
        const attendance = await Attendance.findById(req.params.id)
            .populate('studentId', 'firstName lastName email')
            .populate('courseId', 'name code');

        if (!attendance) {
            throw new AppError('Présence non trouvée', 404);
        }

        res.status(200).json({
            status: 'success',
            data: { attendance }
        });
    }),

    // Créer une présence
    createAttendance: catchAsync(async (req, res) => {
        const attendance = await Attendance.create({
            ...req.body,
            recordedBy: req.user._id
        });

        res.status(201).json({
            status: 'success',
            data: { attendance }
        });
    }),

    // Créer plusieurs présences
    createBulkAttendance: catchAsync(async (req, res) => {
        const { courseId, date, attendances } = req.body;

        const course = await Course.findById(courseId);
        if (!course) {
            throw new AppError('Cours non trouvé', 404);
        }

        const records = attendances.map(att => ({
            courseId,
            date,
            studentId: att.studentId,
            status: att.status,
            note: att.note,
            recordedBy: req.user._id
        }));

        const result = await Attendance.insertMany(records);

        res.status(201).json({
            status: 'success',
            data: { attendances: result }
        });
    }),

    // Mettre à jour une présence
    updateAttendance: catchAsync(async (req, res) => {
        const attendance = await Attendance.findByIdAndUpdate(
            req.params.id,
            {
                ...req.body,
                updatedBy: req.user._id,
                updatedAt: Date.now()
            },
            { new: true, runValidators: true }
        );

        if (!attendance) {
            throw new AppError('Présence non trouvée', 404);
        }

        res.status(200).json({
            status: 'success',
            data: { attendance }
        });
    }),

    // Supprimer une présence
    deleteAttendance: catchAsync(async (req, res) => {
        const attendance = await Attendance.findByIdAndDelete(req.params.id);

        if (!attendance) {
            throw new AppError('Présence non trouvée', 404);
        }

        res.status(204).json({
            status: 'success',
            data: null
        });
    }),

    // Soumettre une justification
    submitJustification: catchAsync(async (req, res) => {
        const attendance = await Attendance.findById(req.params.id);

        if (!attendance) {
            throw new AppError('Présence non trouvée', 404);
        }

        if (attendance.status !== 'ABSENT') {
            throw new AppError('Une justification ne peut être soumise que pour une absence', 400);
        }

        attendance.justification = {
            ...req.body,
            submittedBy: req.user._id,
            submittedAt: Date.now(),
            status: 'PENDING'
        };

        await attendance.save();

        res.status(200).json({
            status: 'success',
            data: { attendance }
        });
    }),

    // Traiter une justification
    handleJustification: catchAsync(async (req, res) => {
        const attendance = await Attendance.findById(req.params.id);

        if (!attendance) {
            throw new AppError('Présence non trouvée', 404);
        }

        if (!attendance.justification) {
            throw new AppError('Aucune justification trouvée', 400);
        }

        attendance.justification.status = req.body.status;
        attendance.justification.handledBy = req.user._id;
        attendance.justification.handledAt = Date.now();
        attendance.justification.comment = req.body.comment;

        if (req.body.status === 'APPROVED') {
            attendance.status = 'EXCUSED';
        }

        await attendance.save();

        res.status(200).json({
            status: 'success',
            data: { attendance }
        });
    }),

    // Obtenir les présences du jour
    getTodayAttendance: catchAsync(async (req, res) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const attendances = await Attendance.find({
            date: {
                $gte: today,
                $lt: tomorrow
            }
        })
        .populate('studentId', 'firstName lastName email')
        .populate('courseId', 'name code');

        res.status(200).json({
            status: 'success',
            data: { attendances }
        });
    }),

    // Obtenir le rapport d'un cours
    getCourseReport: catchAsync(async (req, res) => {
        const { courseId } = req.params;
        const stats = await Attendance.aggregate([
            {
                $match: { courseId: mongoose.Types.ObjectId(courseId) }
            },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                }
            }
        ]);

        const total = stats.reduce((acc, curr) => acc + curr.count, 0);
        const report = stats.reduce((acc, curr) => {
            acc[curr._id.toLowerCase()] = {
                count: curr.count,
                percentage: ((curr.count / total) * 100).toFixed(2)
            };
            return acc;
        }, {});

        res.status(200).json({
            status: 'success',
            data: {
                total,
                report
            }
        });
    }),

    // Obtenir le rapport d'un étudiant
    getStudentReport: catchAsync(async (req, res) => {
        const { studentId } = req.params;
        const stats = await Attendance.aggregate([
            {
                $match: { studentId: mongoose.Types.ObjectId(studentId) }
            },
            {
                $group: {
                    _id: {
                        course: '$courseId',
                        status: '$status'
                    },
                    count: { $sum: 1 }
                }
            }
        ]);

        const courseStats = {};
        stats.forEach(stat => {
            const courseId = stat._id.course.toString();
            if (!courseStats[courseId]) {
                courseStats[courseId] = {};
            }
            courseStats[courseId][stat._id.status.toLowerCase()] = stat.count;
        });

        res.status(200).json({
            status: 'success',
            data: { courseStats }
        });
    }),

    // Obtenir les statistiques globales
    getGlobalStats: catchAsync(async (req, res) => {
        const stats = await Attendance.aggregate([
            {
                $group: {
                    _id: {
                        year: { $year: '$date' },
                        month: { $month: '$date' },
                        status: '$status'
                    },
                    count: { $sum: 1 }
                }
            },
            {
                $sort: {
                    '_id.year': -1,
                    '_id.month': -1
                }
            }
        ]);

        const formattedStats = stats.reduce((acc, curr) => {
            const key = `${curr._id.year}-${String(curr._id.month).padStart(2, '0')}`;
            if (!acc[key]) {
                acc[key] = {};
            }
            acc[key][curr._id.status.toLowerCase()] = curr.count;
            return acc;
        }, {});

        res.status(200).json({
            status: 'success',
            data: { stats: formattedStats }
        });
    })
};

module.exports = attendanceController;