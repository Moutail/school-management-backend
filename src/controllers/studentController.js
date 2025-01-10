const User = require('../models/userModel');
const Course = require('../models/courseModel');
const Attendance = require('../models/attendanceModel');
const Document = require('../models/documentModel');
const { catchAsync } = require('../utils/errorHandlers');
const { NotFoundError } = require('../utils/errors');

// Assurez-vous que chaque fonction est exportée
const getDashboardStats = catchAsync(async (req, res) => {
    const studentId = req.user._id;

    const student = await User.findById(studentId)
        .populate('enrolledCourses')
        .populate('attendanceRecords');

    if (!student) {
        throw new NotFoundError('Étudiant');
    }

    const attendanceRate = student.attendanceRecords.length > 0
        ? (student.attendanceRecords.filter(a => a.status === 'PRESENT').length / student.attendanceRecords.length) * 100
        : 0;

    const unreadDocuments = await Document.countDocuments({
        course: { $in: student.enrolledCourses.map(c => c._id) },
        'readBy.student': { $ne: studentId }
    });

    const nextExam = await Course.findOne({
        _id: { $in: student.enrolledCourses.map(c => c._id) },
        'exams.date': { $gt: new Date() }
    })
    .sort('exams.date')
    .select('title exams');

    res.status(200).json({
        status: 'success',
        data: {
            totalCourses: student.enrolledCourses.length,
            attendanceRate: Math.round(attendanceRate),
            documentsToRead: unreadDocuments,
            nextExam: nextExam ? {
                course: nextExam.title,
                date: new Date(nextExam.exams[0].date).toLocaleDateString('fr-FR')
            } : null
        }
    });
});

const getDashboardActivities = catchAsync(async (req, res) => {
    const studentId = req.user._id;
    
    const activities = [];

    const recentAttendances = await Attendance.find({ student: studentId })
        .sort('-date')
        .limit(3)
        .populate('course', 'title');
    
    recentAttendances.forEach(attendance => {
        activities.push({
            id: attendance._id,
            icon: 'Clock',
            title: `Présence en ${attendance.course.title}`,
            description: `Status: ${attendance.status}`,
            time: new Date(attendance.date).toLocaleDateString('fr-FR')
        });
    });

    const recentDocuments = await Document.find({
        course: { $in: await Course.find({ students: studentId }).distinct('_id') }
    })
    .sort('-createdAt')
    .limit(3)
    .populate('course', 'title');

    recentDocuments.forEach(doc => {
        activities.push({
            id: doc._id,
            icon: 'FileText',
            title: doc.title,
            description: `Document ajouté - ${doc.course.title}`,
            time: new Date(doc.createdAt).toLocaleDateString('fr-FR')
        });
    });

    res.status(200).json({
        status: 'success',
        data: activities.sort((a, b) => new Date(b.time) - new Date(a.time))
    });
});

const getDashboardSchedule = catchAsync(async (req, res) => {
    const studentId = req.user._id;
    
    const todaySchedule = await Course.find({
        students: studentId,
        'schedule.date': {
            $gte: new Date().setHours(0, 0, 0, 0),
            $lt: new Date().setHours(23, 59, 59, 999)
        }
    })
    .populate('professor', 'firstName lastName')
    .select('title schedule room');

    res.status(200).json({
        status: 'success',
        data: todaySchedule.map(course => ({
            id: course._id,
            time: course.schedule[0].time,
            title: course.title,
            professor: `${course.professor.firstName} ${course.professor.lastName}`,
            room: course.room
        }))
    });
});

// Exporter toutes les fonctions
module.exports = {
    getDashboardStats,
    getDashboardActivities,
    getDashboardSchedule
};

// Log pour debug
console.log('Exported functions:', Object.keys(module.exports));