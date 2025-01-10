// src/models/attendanceModel.js
const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
    student: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        validate: {
            validator: async function(v) {
                const user = await mongoose.model('User').findById(v);
                return user && user.role === 'student';
            },
            message: 'L\'identifiant doit correspondre à un étudiant valide'
        }
    },
    course: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Course',
        required: true,
        validate: {
            validator: async function(v) {
                const course = await mongoose.model('Course').findById(v);
                return course !== null;
            },
            message: 'Le cours spécifié n\'existe pas'
        }
    },
    date: {
        type: Date,
        required: true,
        validate: {
            validator: function(v) {
                return v <= new Date();
            },
            message: 'La date ne peut pas être dans le futur'
        }
    },
    status: {
        type: String,
        enum: ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'],
        required: true,
        default: 'ABSENT'
    },
    arrivalTime: {
        type: Date,
        validate: {
            validator: function(v) {
                return !v || v >= this.date;
            },
            message: 'L\'heure d\'arrivée ne peut pas être antérieure à la date du cours'
        }
    },
    justification: {
        reason: String,
        document: String,
        status: {
            type: String,
            enum: ['PENDING', 'APPROVED', 'REJECTED'],
            default: 'PENDING'
        },
        approvedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        submittedAt: Date,
        updatedAt: Date
    }
}, { timestamps: true });

attendanceSchema.index({ student: 1, date: 1 });
attendanceSchema.index({ course: 1, date: 1 });
attendanceSchema.index({ date: 1 });
attendanceSchema.index({ status: 1 });

const Attendance = mongoose.model('Attendance', attendanceSchema);

module.exports = Attendance;