// src/controllers/notificationController.js
const { Notification } = require('../models');
const UserPreference = require('../models/userPreferenceModel');
const notificationService = require('../services/notificationService');
const { AppError } = require('../utils/errors');
const { catchAsync } = require('../utils/errorHandlers');

const notificationController = {
    getNotifications: catchAsync(async (req, res) => {
        const { page = 1, limit = 20, type, isRead, startDate, endDate, priority } = req.query;
        const query = { recipient: req.user._id };

        if (type) query.type = type;
        if (typeof isRead !== 'undefined') query.isRead = isRead;
        if (priority) query.priority = priority;
        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) query.createdAt.$gte = new Date(startDate);
            if (endDate) query.createdAt.$lte = new Date(endDate);
        }

        const [notifications, total] = await Promise.all([
            Notification.find(query)
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .populate('sender', 'firstName lastName'),
            Notification.countDocuments(query)
        ]);

        const unreadCount = await Notification.countDocuments({
            recipient: req.user._id,
            isRead: false
        });

        res.status(200).json({
            status: 'success',
            data: {
                notifications,
                pagination: {
                    total,
                    pages: Math.ceil(total / limit),
                    page,
                    limit
                },
                unreadCount
            }
        });
    }),

    createNotification: catchAsync(async (req, res) => {
        const recipientArray = Array.isArray(req.body.recipients) ? req.body.recipients : [req.body.recipients];
        const recipientPrefs = await UserPreference.find({ user: { $in: recipientArray } });

        const notifications = await Promise.all(recipientArray.map(async (recipient) => {
            const prefs = recipientPrefs.find(p => p.user.toString() === recipient);
            const shouldSend = prefs ? !isInDoNotDisturbPeriod(prefs) : true;

            if (!shouldSend) return null;

            const notification = await Notification.create({
                ...req.body,
                recipient,
                sender: req.user._id
            });

            if (prefs?.email?.enabled) {
                await notificationService.sendEmail(recipient, {
                    subject: req.body.title,
                    message: req.body.message
                });
            }

            if (prefs?.push?.enabled) {
                await notificationService.sendPushNotification(recipient, {
                    title: req.body.title,
                    message: req.body.message
                });
            }

            return notification;
        }));

        res.status(201).json({
            status: 'success',
            data: {
                notifications: notifications.filter(Boolean)
            }
        });
    }),

    markAsRead: catchAsync(async (req, res) => {
        const notification = await Notification.findOneAndUpdate(
            {
                _id: req.params.id,
                recipient: req.user._id
            },
            {
                $set: { isRead: true, readAt: new Date() }
            },
            { new: true }
        );

        if (!notification) {
            throw new AppError('Notification non trouvée', 404);
        }

        res.status(200).json({
            status: 'success',
            data: { notification }
        });
    }),

    markMultipleAsRead: catchAsync(async (req, res) => {
        const result = await Notification.updateMany(
            {
                _id: { $in: req.body.ids },
                recipient: req.user._id
            },
            {
                $set: { isRead: true, readAt: new Date() }
            }
        );

        res.status(200).json({
            status: 'success',
            data: {
                modified: result.nModified
            }
        });
    }),

    markAllAsRead: catchAsync(async (req, res) => {
        const query = {
            recipient: req.user._id,
            isRead: false
        };

        if (req.body.beforeDate) {
            query.createdAt = { $lte: new Date(req.body.beforeDate) };
        }
        if (req.body.type) {
            query.type = req.body.type;
        }

        const result = await Notification.updateMany(
            query,
            {
                $set: { isRead: true, readAt: new Date() }
            }
        );

        res.status(200).json({
            status: 'success',
            data: {
                modified: result.nModified
            }
        });
    }),

    deleteNotification: catchAsync(async (req, res) => {
        const notification = await Notification.findOneAndDelete({
            _id: req.params.id,
            recipient: req.user._id
        });

        if (!notification) {
            throw new AppError('Notification non trouvée', 404);
        }

        res.status(200).json({
            status: 'success',
            message: 'Notification supprimée avec succès'
        });
    }),

    getNotificationPreferences: catchAsync(async (req, res) => {
        let preferences = await UserPreference.findOne({ user: req.user._id });

        if (!preferences) {
            preferences = await UserPreference.create({
                user: req.user._id,
                email: { enabled: true, frequency: 'IMMEDIATE' },
                push: { enabled: true },
                doNotDisturb: { enabled: false }
            });
        }

        res.status(200).json({
            status: 'success',
            data: { preferences }
        });
    }),

    updateNotificationPreferences: catchAsync(async (req, res) => {
        const preferences = await UserPreference.findOneAndUpdate(
            { user: req.user._id },
            { $set: req.body },
            { new: true, upsert: true }
        );

        res.status(200).json({
            status: 'success',
            data: { preferences }
        });
    })
};

// Fonction utilitaire pour vérifier la période "Ne pas déranger"
function isInDoNotDisturbPeriod(preferences) {
    if (!preferences.doNotDisturb?.enabled) return false;

    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const { startTime, endTime } = preferences.doNotDisturb;

    if (startTime < endTime) {
        return currentTime >= startTime && currentTime < endTime;
    } else {
        return currentTime >= startTime || currentTime < endTime;
    }
}

module.exports = notificationController;