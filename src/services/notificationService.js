// src/services/notificationService.js
const User = require('../models/userModel');
const { Notification } = require('../models');

const notificationService = {
    /**
     * Envoie une notification par email
     */
    async sendEmail(userId, { subject, message, template = 'default' }) {
        const user = await User.findById(userId);
        if (!user?.email) return;

        // TODO: Implémentez l'envoi d'email réel ici
        console.log(`Email envoyé à ${user.email}:`, { subject, message, template });
    },

    /**
     * Envoie une notification push
     */
    async sendPushNotification(userId, { title, message, data = {} }) {
        const user = await User.findById(userId);
        if (!user) return;

        // TODO: Implémentez l'envoi de notification push réel ici
        console.log(`Push notification envoyée à l'utilisateur ${userId}:`, { title, message, data });
    },

    /**
     * Crée une notification dans la base de données
     */
    async createNotification(data) {
        return await Notification.create({
            ...data,
            createdAt: new Date()
        });
    },

    /**
     * Marque une notification comme lue
     */
    async markAsRead(notificationId, userId) {
        return await Notification.findOneAndUpdate(
            { _id: notificationId, recipient: userId },
            { isRead: true, readAt: new Date() },
            { new: true }
        );
    },

    /**
     * Récupère les notifications non lues d'un utilisateur
     */
    async getUnreadNotifications(userId) {
        return await Notification.find({
            recipient: userId,
            isRead: false
        }).sort({ createdAt: -1 });
    }
};

module.exports = notificationService;