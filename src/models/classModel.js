// src/models/classModel.js
const mongoose = require('mongoose');

const classSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Le nom de la classe est requis'],
        trim: true,
        unique: true
    },
    level: {
        type: String,
        required: [true, 'Le niveau est requis'],
        trim: true
    },
    academicYear: {
        type: String,
        required: [true, 'L\'année académique est requise']
    },
    major: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    professors: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    students: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    courses: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Course'
    }],
    stats: {
        averageAttendance: {
            type: Number,
            default: 0
        },
        averagePerformance: {
            type: Number,
            default: 0
        }
    },
    schedule: [{
        day: {
            type: Number,
            required: true,
            min: 0,
            max: 6
        },
        slots: [{
            startTime: String,
            endTime: String,
            course: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Course'
            },
            room: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Room'
            }
        }]
    }]
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Index composés
classSchema.index({ name: 1, academicYear: 1 }, { unique: true });
classSchema.index({ level: 1, academicYear: 1 });

// Méthode statique pour calculer les statistiques
classSchema.statics.calculateStats = async function(classId) {
    const stats = await this.aggregate([
        {
            $match: { _id: mongoose.Types.ObjectId(classId) }
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
                        {
                            $divide: [
                                {
                                    $size: {
                                        $filter: {
                                            input: '$attendances',
                                            as: 'attendance',
                                            cond: { $eq: ['$$attendance.status', 'PRESENT'] }
                                        }
                                    }
                                },
                                { $size: '$attendances' }
                            ]
                        },
                        100
                    ]
                },
                averagePerformance: {
                    $avg: '$grades.value'
                }
            }
        }
    ]);

    if (stats.length > 0) {
        await this.findByIdAndUpdate(classId, {
            'stats.averageAttendance': stats[0].averageAttendance,
            'stats.averagePerformance': stats[0].averagePerformance
        });
    }

    return stats[0];
};

// Middleware pre-save
classSchema.pre('save', async function(next) {
    if (this.isModified('students') || this.isModified('major')) {
        // Mettre à jour les références des utilisateurs
        if (this.major) {
            await mongoose.model('User').updateOne(
                { _id: this.major },
                { $set: { role: 'major', class: this._id } }
            );
        }
    }
    next();
});

const Class = mongoose.model('Class', classSchema);

module.exports = Class;