// src/utils/notifications.js
const User = require('../models/userModel');
const UserPreference = require('../models/userPreferenceModel');

// Envoyer une notification à un groupe d'utilisateurs
const notifyParticipants = async (users, notification) => {
    try {
        // Vérifier si users est un tableau ou un ID unique
        const userIds = Array.isArray(users) ? users : [users];

        // Récupérer les préférences des utilisateurs
        const preferences = await UserPreference.find({
            user: { $in: userIds }
        });

        // Envoyer les notifications selon les préférences de chaque utilisateur
        const notificationPromises = preferences.map(async (pref) => {
            if (pref.notifications.email) {
                await sendEmailNotification(pref.user, notification);
            }
            if (pref.notifications.push) {
                await sendPushNotification(pref.user, notification);
            }
        });

        await Promise.all(notificationPromises);
    } catch (error) {
        console.error('Erreur lors de l\'envoi des notifications:', error);
    }
};

// Envoyer une notification à une classe entière
const createClassNotification = async (classId, notification) => {
    try {
        // Récupérer tous les étudiants de la classe
        const students = await User.find({
            class: classId,
            role: 'student'
        }).select('_id');

        // Récupérer les préférences des étudiants
        const preferences = await UserPreference.find({
            user: { $in: students.map(s => s._id) }
        });

        // Envoyer les notifications
        const notificationPromises = preferences.map(async (pref) => {
            if (pref.notifications.email) {
                await sendEmailNotification(pref.user, notification);
            }
            if (pref.notifications.push) {
                await sendPushNotification(pref.user, notification);
            }
        });

        await Promise.all(notificationPromises);
    } catch (error) {
        console.error('Erreur lors de l\'envoi des notifications de classe:', error);
    }
};

// Envoyer un email de notification
const sendEmailNotification = async (userId, notification) => {
    try {
        const user = await User.findById(userId);
        if (!user || !user.email) return;

        // Ici, implémentez l'envoi d'email selon votre configuration
        // Par exemple avec nodemailer
        console.log(`Email envoyé à ${user.email}:`, notification);
    } catch (error) {
        console.error('Erreur lors de l\'envoi de l\'email:', error);
    }
};

// Envoyer une notification push
const sendPushNotification = async (userId, notification) => {
    try {
        const user = await User.findById(userId);
        if (!user) return;

        // Ici, implémentez l'envoi de notification push selon votre configuration
        // Par exemple avec Firebase Cloud Messaging ou autre service
        console.log(`Notification push envoyée à l'utilisateur ${userId}:`, notification);
    } catch (error) {
        console.error('Erreur lors de l\'envoi de la notification push:', error);
    }
};

module.exports = {
    notifyParticipants,
    createClassNotification,
    sendEmailNotification,
    sendPushNotification
};