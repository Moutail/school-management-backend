const User = require('../models/userModel');
const Course = require('../models/courseModel');
const Attendance = require('../models/attendanceModel');
const Document = require('../models/documentModel');
const { catchAsync } = require('../utils/errorHandlers');
const { NotFoundError, AuthorizationError } = require('../utils/errors');

exports.getChildren = catchAsync(async (req, res) => {
    const parentId = req.user._id;

    const parent = await User.findById(parentId)
        .populate({
            path: 'children',
            select: 'firstName lastName class profileImage',
            populate: {
                path: 'class',
                select: 'name level'
            }
        });

    if (!parent) {
        throw new NotFoundError('Parent');
    }

    res.status(200).json({
        status: 'success',
        data: {
            children: parent.children.map(child => ({
                _id: child._id,
                firstName: child.firstName,
                lastName: child.lastName,
                class: child.class?.name || 'Non assigné',
                profileImage: child.profileImage
            }))
        }
    });
});

exports.getChildStats = catchAsync(async (req, res) => {
    const { childId } = req.params;
    const parentId = req.user._id;

    // Vérifier que l'enfant appartient au parent
    const parent = await User.findById(parentId);
    if (!parent.children.includes(childId)) {
        throw new AuthorizationError('Vous n\'avez pas accès aux informations de cet étudiant');
    }

    const child = await User.findById(childId)
        .populate('enrolledCourses')
        .populate('attendanceRecords', null, {
            date: { $gte: new Date(new Date().setMonth(new Date().getMonth() - 1)) }
        })
        .populate('class');

    if (!child) {
        throw new NotFoundError('Étudiant');
    }

    // Calculer les statistiques
    const attendanceRate = child.attendanceRecords.length > 0
        ? (child.attendanceRecords.filter(a => a.status === 'PRESENT').length / child.attendanceRecords.length) * 100
        : 0;

    // Documents non lus
    const unreadDocuments = await Document.countDocuments({
        course: { $in: child.enrolledCourses.map(c => c._id) },
        'readBy.student': { $ne: childId }
    });

    // Prochain examen
    const nextExam = await Course.findOne({
        _id: { $in: child.enrolledCourses.map(c => c._id) },
        'exams.date': { $gt: new Date() }
    })
    .sort('exams.date')
    .select('title exams');

    res.status(200).json({
        status: 'success',
        data: {
            student: {
                name: `${child.firstName} ${child.lastName}`,
                class: child.class?.name || 'Non assigné'
            },
            stats: {
                coursesCount: child.enrolledCourses.length,
                attendanceRate: Math.round(attendanceRate),
                unreadDocuments,
                recentAbsences: child.attendanceRecords.filter(a => a.status === 'ABSENT').length,
                nextExam: nextExam ? {
                    course: nextExam.title,
                    date: new Date(nextExam.exams[0].date).toLocaleDateString('fr-FR')
                } : null
            }
        }
    });
});

exports.getChildSchedule = catchAsync(async (req, res) => {
    const { childId } = req.params;
    const parentId = req.user._id;

    // Vérifier que l'enfant appartient au parent
    const parent = await User.findById(parentId);
    if (!parent.children.includes(childId)) {
        throw new AuthorizationError('Vous n\'avez pas accès à l\'emploi du temps de cet étudiant');
    }

    const schedule = await Course.find({
        students: childId,
        'schedule.date': {
            $gte: new Date().setHours(0, 0, 0, 0),
            $lt: new Date().setHours(23, 59, 59, 999)
        }
    })
    .populate('professor', 'firstName lastName')
    .select('title schedule room');

    res.status(200).json({
        status: 'success',
        data: schedule.map(course => ({
            id: course._id,
            time: course.schedule[0].time,
            title: course.title,
            professor: `${course.professor.firstName} ${course.professor.lastName}`,
            room: course.room
        }))
    });
});

exports.getChildAttendance = catchAsync(async (req, res) => {
    const { childId } = req.params;
    const parentId = req.user._id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Vérifier que l'enfant appartient au parent
    const parent = await User.findById(parentId);
    if (!parent.children.includes(childId)) {
        throw new AuthorizationError('Vous n\'avez pas accès aux présences de cet étudiant');
    }

    const [attendances, total] = await Promise.all([
        Attendance.find({ student: childId })
            .populate('course', 'title')
            .populate('student', 'firstName lastName')
            .sort('-date')
            .skip(skip)
            .limit(limit),
        Attendance.countDocuments({ student: childId })
    ]);

    res.status(200).json({
        status: 'success',
        data: {
            attendances: attendances.map(attendance => ({
                id: attendance._id,
                date: new Date(attendance.date).toLocaleDateString('fr-FR'),
                course: attendance.course.title,
                status: attendance.status,
                student: `${attendance.student.firstName} ${attendance.student.lastName}`,
                justification: attendance.justification
            })),
            pagination: {
                page,
                pages: Math.ceil(total / limit),
                total
            }
        }
    });
});

exports.getChildActivities = catchAsync(async (req, res) => {
    const { childId } = req.params;
    const parentId = req.user._id;

    // Vérifier que l'enfant appartient au parent
    const parent = await User.findById(parentId);
    if (!parent.children.includes(childId)) {
        throw new AuthorizationError('Vous n\'avez pas accès aux activités de cet étudiant');
    }

    const activities = [];

    // Récupérer les dernières absences
    const recentAttendances = await Attendance.find({
        student: childId,
        status: 'ABSENT'
    })
    .sort('-date')
    .limit(5)
    .populate('course', 'title');

    activities.push(...recentAttendances.map(attendance => ({
        type: 'ABSENCE',
        date: new Date(attendance.date).toLocaleDateString('fr-FR'),
        course: attendance.course.title,
        status: attendance.status
    })));

    // Récupérer les derniers documents à consulter
    const recentDocuments = await Document.find({
        course: { $in: await Course.find({ students: childId }).distinct('_id') },
        'readBy.student': { $ne: childId }
    })
    .sort('-createdAt')
    .limit(5)
    .populate('course', 'title');

    activities.push(...recentDocuments.map(doc => ({
        type: 'DOCUMENT',
        date: new Date(doc.createdAt).toLocaleDateString('fr-FR'),
        title: doc.title,
        course: doc.course.title
    })));

    res.status(200).json({
        status: 'success',
        data: {
            activities: activities.sort((a, b) => new Date(b.date) - new Date(a.date))
        }
    });
});

module.exports = exports;