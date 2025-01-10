// src/models/activityLogModel.js
const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
        // Suppression de index: true ici
    },
    action: {
        type: String,
        required: true,
        enum: [
            'REGISTER',  // Ajouter cette ligne
            'LOGIN',
            'LOGOUT',
            'PROFILE_UPDATE',
            'PASSWORD_CHANGE',
            'PREFERENCES_UPDATE',
            'DOCUMENT_UPLOAD',
            'DOCUMENT_DELETE',
            'GRADE_SUBMIT',
            'ATTENDANCE_MARK',
            'COURSE_CREATE',
            'COURSE_UPDATE',
            'SETTINGS_UPDATE',
            'NOTIFICATION_SEND',
            'USER_BLOCK',
            'USER_UNBLOCK',
            'ROLE_UPDATE',
            'SESSIONS_MANAGED'
        ]
    },
    details: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    performedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    ip: String,
    userAgent: String,
    status: {
        type: String,
        enum: ['SUCCESS', 'FAILURE', 'ERROR'],
        default: 'SUCCESS'
    },
    errorDetails: {
        type: String,
        select: false
    }
}, {
    timestamps: true
});

// Index optimisés
activityLogSchema.index({ createdAt: -1 });
activityLogSchema.index({ action: 1, createdAt: -1 });
activityLogSchema.index({ user: 1, action: 1, createdAt: -1 });

// Méthodes statiques
activityLogSchema.statics.logActivity = async function(data) {
    try {
        const activity = new this({
            user: data.user,
            action: data.action,
            details: data.details || {},
            performedBy: data.performedBy || data.user,
            ip: data.ip,
            userAgent: data.userAgent,
            status: data.status || 'SUCCESS',
            errorDetails: data.error
        });

        return await activity.save();
    } catch (error) {
        console.error('Erreur lors de l\'enregistrement de l\'activité:', error);
        return null;
    }
};

activityLogSchema.statics.getUserActivity = async function(userId, limit = 10) {
    return this.find({ user: userId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate('performedBy', 'firstName lastName role');
};

activityLogSchema.statics.cleanOldLogs = async function(daysToKeep = 30) {
    const dateThreshold = new Date();
    dateThreshold.setDate(dateThreshold.getDate() - daysToKeep);

    return this.deleteMany({
        createdAt: { $lt: dateThreshold }
    });
};

const ActivityLog = mongoose.model('ActivityLog', activityLogSchema);

module.exports = ActivityLog;