// src/models/index.js
const mongoose = require('mongoose');

// Schemas
const activitySchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Le titre est requis'],
        trim: true
    },
    description: String,
    deadline: Date,
    type: {
        type: String,
        enum: ['HOMEWORK', 'PROJECT', 'EVENT', 'OTHER'],
        required: true
    },
    status: {
        type: String,
        enum: ['PENDING', 'IN_PROGRESS', 'COMPLETED'],
        default: 'PENDING'
    },
    participants: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    attachments: [{
        name: String,
        url: String,
        type: String
    }]
}, {
    timestamps: true
});

const eventSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Le titre est requis'],
        trim: true
    },
    description: String,
    date: {
        type: Date,
        required: true
    },
    location: String,
    type: {
        type: String,
        enum: ['ACADEMIC', 'SOCIAL', 'SPORT', 'OTHER'],
        default: 'OTHER'
    },
    participants: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    status: {
        type: String,
        enum: ['UPCOMING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
        default: 'UPCOMING'
    }
}, {
    timestamps: true
});

const alertSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Le titre est requis'],
        trim: true
    },
    message: {
        type: String,
        required: [true, 'Le message est requis']
    },
    priority: {
        type: String,
        enum: ['LOW', 'MEDIUM', 'HIGH'],
        default: 'MEDIUM'
    },
    status: {
        type: String,
        enum: ['ACTIVE', 'RESOLVED', 'ARCHIVED'],
        default: 'ACTIVE'
    },
    targetUsers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }]
}, {
    timestamps: true
});

const notificationSchema = new mongoose.Schema({
    recipient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
        // Pas d'index ici
    },
    type: {
        type: String,
        enum: ['HOMEWORK', 'EXAM', 'PAYMENT', 'ADMIN', 'COURSE', 'ATTENDANCE'],
        required: true
    },
    title: String,
    message: String,
    isRead: {
        type: Boolean,
        default: false
    },
    scheduledFor: Date,
    expiresAt: Date
}, {
    timestamps: true
});

const majorPrivilegesSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    class: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Class',
        required: true
    },
    academicYear: {
        type: String,
        required: true
    },
    permissions: {
        canManageActivities: {
            type: Boolean,
            default: true
        },
        canOrganizeEvents: {
            type: Boolean,
            default: true
        },
        canViewClassStats: {
            type: Boolean,
            default: true
        },
        canSendAlerts: {
            type: Boolean,
            default: true
        }
    },
    activities: [activitySchema],
    events: [eventSchema],
    alerts: [alertSchema]
}, {
    timestamps: true
});

const archiveSchema = new mongoose.Schema({
    academicYear: String,
    period: String,
    course: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Course'
    },
    documents: [{
        title: String,
        path: String,
        type: String,
        uploadedAt: Date
    }],
    grades: [{
        student: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        value: Number,
        type: String,
        date: Date
    }]
}, {
    timestamps: true
});

// Indexes
majorPrivilegesSchema.index(
    { user: 1, class: 1, academicYear: 1 },
    { unique: true }
);

notificationSchema.index({ recipient: 1, isRead: 1 });
archiveSchema.index({ academicYear: 1, course: 1 });

// Models
const MajorPrivileges = mongoose.model('MajorPrivileges', majorPrivilegesSchema);
const Notification = mongoose.model('Notification', notificationSchema);
const Archive = mongoose.model('Archive', archiveSchema);

module.exports = {
    MajorPrivileges,
    Notification,
    Archive
};