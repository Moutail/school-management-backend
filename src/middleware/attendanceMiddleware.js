// src/middleware/attendanceMiddleware.js
const { AppError } = require('../utils/errors');
const Course = require('../models/courseModel');
const { AcademicPeriod } = require('../models');

const attendanceMiddleware = {
    checkActivePeriod: async (req, res, next) => {
        try {
            const currentPeriod = await AcademicPeriod.findOne({
                status: 'ACTIVE',
                startDate: { $lte: new Date() },
                endDate: { $gte: new Date() }
            });

            if (!currentPeriod) {
                throw new AppError('No active academic period found', 400);
            }

            req.academicPeriod = currentPeriod;
            next();
        } catch (error) {
            next(error);
        }
    },

    validateAttendanceData: async (req, res, next) => {
        try {
            const { courseId, studentId, date } = req.body;

            // Vérifier si le cours existe
            const course = await Course.findById(courseId);
            if (!course) {
                throw new AppError('Course not found', 404);
            }

            // Vérifier si le professeur est assigné au cours
            if (req.user.role === 'professor' && 
                course.professor.toString() !== req.user._id.toString()) {
                throw new AppError('You are not authorized to manage attendance for this course', 403);
            }

            // Vérifier si la date n'est pas dans le futur
            if (new Date(date) > new Date()) {
                throw new AppError('Cannot mark attendance for future dates', 400);
            }

            // Vérifier si l'étudiant est inscrit au cours
            if (!course.students.includes(studentId)) {
                throw new AppError('Student is not enrolled in this course', 400);
            }

            next();
        } catch (error) {
            next(error);
        }
    },

    canSubmitJustification: async (req, res, next) => {
        try {
            const attendance = await Attendance.findById(req.params.recordId);
            if (!attendance) {
                throw new AppError('Attendance record not found', 404);
            }

            // Vérifier si l'utilisateur est autorisé
            const isStudent = attendance.student.toString() === req.user._id.toString();
            const isParent = req.user.children?.includes(attendance.student);
            
            if (!isStudent && !isParent) {
                throw new AppError('Not authorized to submit justification', 403);
            }

            next();
        } catch (error) {
            next(error);
        }
    },

    checkModifyPermissions: async (req, res, next) => {
        try {
            const attendance = await Attendance.findById(req.params.recordId)
                .populate('course');

            if (!attendance) {
                throw new AppError('Attendance record not found', 404);
            }

            const isProfessor = attendance.course.professor.toString() === req.user._id.toString();
            if (!isProfessor && req.user.role !== 'admin') {
                throw new AppError('Not authorized to modify this attendance record', 403);
            }

            next();
        } catch (error) {
            next(error);
        }
    }
};

module.exports = attendanceMiddleware;