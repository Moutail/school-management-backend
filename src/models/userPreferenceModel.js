// src/models/userPreferenceModel.js
const mongoose = require('mongoose');

const userPreferenceSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
        // Suppression de unique: true ici car nous utilisons schema.index()
    },
    theme: {
        type: String,
        enum: ['light', 'dark', 'system'],
        default: 'system'
    },
    language: {
        type: String,
        enum: ['fr', 'en'],
        default: 'fr'
    },
    notifications: {
        email: {
            type: Boolean,
            default: true
        },
        push: {
            type: Boolean,
            default: true
        },
        types: [{
            type: String,
            enum: ['COURSE', 'GRADE', 'ATTENDANCE', 'EVENT', 'ANNOUNCEMENT']
        }]
    },
    display: {
        itemsPerPage: {
            type: Number,
            default: 10,
            min: 5,
            max: 100
        },
        showNotifications: {
            type: Boolean,
            default: true
        }
    }
}, {
    timestamps: true
});

// Un seul index unique sur user
userPreferenceSchema.index({ user: 1 }, { unique: true });

userPreferenceSchema.virtual('notificationsEnabled').get(function() {
    return this.notifications.email || this.notifications.push;
});

const UserPreference = mongoose.model('UserPreference', userPreferenceSchema);

module.exports = UserPreference;