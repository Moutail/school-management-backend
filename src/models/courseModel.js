// 3. Course Model optimisé (models/courseModel.js)
const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Le titre du cours est requis'],
        trim: true,
        maxlength: [100, 'Le titre ne peut pas dépasser 100 caractères']
    },
    code: {
        type: String,
        required: [true, 'Le code du cours est requis'],
        unique: true,
        uppercase: true,
        validate: {
            validator: function(v) {
                return /^[A-Z]{3}[0-9]{3}$/.test(v);
            },
            message: 'Le code du cours doit suivre le format: XXX000'
        }
    },
    professor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        validate: {
            validator: async function(v) {
                const user = await mongoose.model('User').findById(v);
                return user && user.role === 'professor';
            },
            message: 'Le professeur assigné n\'est pas valide'
        }
    },
    classes: [{
        class: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Class',
            required: true
        },
        schedule: [{
            day: {
                type: Number,
                required: true,
                min: 0,
                max: 6
            },
            startTime: {
                type: String,
                required: true,
                validate: {
                    validator: function(v) {
                        return /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(v);
                    },
                    message: 'Format d\'heure invalide (HH:MM)'
                }
            },
            endTime: {
                type: String,
                required: true,
                validate: {
                    validator: function(v) {
                        return /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(v);
                    },
                    message: 'Format d\'heure invalide (HH:MM)'
                }
            },
            room: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Room',
                required: true
            }
        }]
    }],
    description: {
        type: String,
        maxlength: [1000, 'La description ne peut pas dépasser 1000 caractères']
    },
    objectives: [String],
    requirements: [String],
    periods: [{
        period: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'AcademicPeriod',
            required: true
        },
        documents: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Document'
        }]
    }]
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

courseSchema.index({ title: 'text', code: 'text' });
courseSchema.index({ professor: 1, 'classes.class': 1 });
courseSchema.index({ 'periods.period': 1 });

const Course = mongoose.model('Course', courseSchema);

module.exports = Course;