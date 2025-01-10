// backend/src/models/blockingHistoryModel.js
const mongoose = require('mongoose');

const blockingHistorySchema = new mongoose.Schema({
    student: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true // Pour optimiser les recherches par étudiant
    },
    action: {
        type: String,
        enum: ['BLOCK', 'UNBLOCK'],
        required: true
    },
    reason: {
        type: String,
        required: true,
        trim: true,
        minlength: [3, 'La raison doit faire au moins 3 caractères'],
        maxlength: [500, 'La raison ne peut pas dépasser 500 caractères']
    },
    performedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true // Pour optimiser les recherches par administrateur
    },
    duration: {
        type: Number,
        min: [1, 'La durée minimale est de 1 jour'],
        max: [365, 'La durée maximale est de 365 jours']
    },
    blockEndDate: {
        type: Date,
        validate: {
            validator: function(value) {
                // La date de fin doit être dans le futur si elle est définie
                return !value || value > new Date();
            },
            message: 'La date de fin de blocage doit être dans le futur'
        }
    }
}, { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Index composé pour optimiser les recherches fréquentes
blockingHistorySchema.index({ student: 1, createdAt: -1 });

// Virtuals
blockingHistorySchema.virtual('isExpired').get(function() {
    if (!this.blockEndDate) return false;
    return new Date() > this.blockEndDate;
});

// Methods
blockingHistorySchema.methods.getRemainingDays = function() {
    if (!this.blockEndDate || this.isExpired) return 0;
    const now = new Date();
    const diff = this.blockEndDate - now;
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

// Statics
blockingHistorySchema.statics.getStudentHistory = async function(studentId) {
    return this.find({ student: studentId })
        .populate('performedBy', 'firstName lastName')
        .sort({ createdAt: -1 });
};

// Pre-save middleware
blockingHistorySchema.pre('save', function(next) {
    // Si une durée est spécifiée mais pas de date de fin, calculer la date de fin
    if (this.duration && !this.blockEndDate) {
        this.blockEndDate = new Date(Date.now() + this.duration * 24 * 60 * 60 * 1000);
    }
    next();
});

const BlockingHistory = mongoose.model('BlockingHistory', blockingHistorySchema);

module.exports = BlockingHistory;