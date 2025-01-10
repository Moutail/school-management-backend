// src/models/academicPeriodModel.js
const mongoose = require('mongoose');

const academicPeriodSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Le nom de la période est requis'],
        trim: true
    },
    startDate: {
        type: Date,
        required: [true, 'La date de début est requise']
    },
    endDate: {
        type: Date,
        required: [true, 'La date de fin est requise'],
        validate: {
            validator: function(value) {
                return value > this.startDate;
            },
            message: 'La date de fin doit être postérieure à la date de début'
        }
    },
    status: {
        type: String,
        enum: ['ACTIVE', 'UPCOMING', 'COMPLETED'],
        default: 'UPCOMING'
    },
    description: {
        type: String,
        trim: true
    }
}, {
    timestamps: true
});

// Index pour les recherches fréquentes
academicPeriodSchema.index({ status: 1, startDate: 1 });
academicPeriodSchema.index({ endDate: 1 });

module.exports = mongoose.model('AcademicPeriod', academicPeriodSchema);