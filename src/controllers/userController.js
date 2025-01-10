// src/controllers/userController.js
const User = require('../models/userModel');
const UserPreference = require('../models/userPreferenceModel');
const ActivityLog = require('../models/activityLogModel');
const AppError = require('../utils/errors');
const { catchAsync } = require('../utils/errorHandlers');
const mongoose = require('mongoose');

const userController = {
    // Obtenir le profil de l'utilisateur connecté
    getProfile: catchAsync(async (req, res) => {
        const user = await User.findById(req.user._id).select('-password');
        
        res.status(200).json({
            status: 'success',
            data: { user }
        });
    }),

    // Obtenir tous les utilisateurs (pour l'admin)
    getAllUsers: catchAsync(async (req, res) => {
        const { role, search, status, page = 1, limit = 10, sortBy = 'createdAt', order = 'desc' } = req.query;
        
        const query = {};
        
        if (role) query.role = role;
        if (status) query.status = status;
        if (search) {
            query.$or = [
                { firstName: { $regex: search, $options: 'i' } },
                { lastName: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } }
            ];
        }

        const users = await User.find(query)
            .select('-password')
            .sort({ [sortBy]: order === 'desc' ? -1 : 1 })
            .skip((page - 1) * limit)
            .limit(limit);

        const total = await User.countDocuments(query);

        res.status(200).json({
            status: 'success',
            data: {
                users,
                pagination: {
                    total,
                    pages: Math.ceil(total / limit),
                    page: Number(page),
                    limit: Number(limit)
                }
            }
        });
    }),

    // Obtenir un utilisateur spécifique
    getUserById: catchAsync(async (req, res) => {
        const user = await User.findById(req.params.id)
            .select('-password')
            .populate('preferences');

        if (!user) {
            throw new AppError('Utilisateur non trouvé', 404);
        }

        res.status(200).json({
            status: 'success',
            data: { user }
        });
    }),

    // Mettre à jour le profil
    updateProfile: catchAsync(async (req, res) => {
        if (req.body.password) {
            throw new AppError('Cette route n\'est pas pour la mise à jour du mot de passe', 400);
        }

        const updatedUser = await User.findByIdAndUpdate(
            req.user._id,
            req.body,
            { new: true, runValidators: true }
        ).select('-password');

        await ActivityLog.logActivity({
            user: req.user._id,
            action: 'PROFILE_UPDATE',
            details: { updatedFields: Object.keys(req.body) }
        });

        res.status(200).json({
            status: 'success',
            data: { user: updatedUser }
        });
    }),

    // Mettre à jour le mot de passe
    updatePassword: catchAsync(async (req, res) => {
        const user = await User.findById(req.user._id).select('+password');

        if (!(await user.comparePassword(req.body.currentPassword))) {
            throw new AppError('Mot de passe actuel incorrect', 401);
        }

        user.password = req.body.newPassword;
        await user.save();

        await ActivityLog.logActivity({
            user: req.user._id,
            action: 'PASSWORD_CHANGE'
        });

        res.status(200).json({
            status: 'success',
            message: 'Mot de passe mis à jour avec succès'
        });
    }),

    // Obtenir les préférences utilisateur
    getUserPreferences: catchAsync(async (req, res) => {
        let preferences = await UserPreference.findOne({ user: req.user._id });

        if (!preferences) {
            preferences = await UserPreference.create({
                user: req.user._id,
                theme: 'system',
                language: 'fr',
                notifications: {
                    email: true,
                    push: true,
                    types: ['COURSE', 'GRADE', 'ATTENDANCE', 'EVENT', 'ANNOUNCEMENT']
                }
            });
        }

        res.status(200).json({
            status: 'success',
            data: { preferences }
        });
    }),

    // Mettre à jour les préférences
    updatePreferences: catchAsync(async (req, res) => {
        const preferences = await UserPreference.findOneAndUpdate(
            { user: req.user._id },
            req.body,
            { new: true, runValidators: true, upsert: true }
        );

        await ActivityLog.logActivity({
            user: req.user._id,
            action: 'PREFERENCES_UPDATE',
            details: { updates: req.body }
        });

        res.status(200).json({
            status: 'success',
            data: { preferences }
        });
    }),

    // Obtenir les statistiques utilisateur
    getUserStats: catchAsync(async (req, res) => {
        const { startDate, endDate, role } = req.query;
        const match = {};

        if (role) match.role = role;
        if (startDate || endDate) {
            match.createdAt = {};
            if (startDate) match.createdAt.$gte = new Date(startDate);
            if (endDate) match.createdAt.$lte = new Date(endDate);
        }

        const stats = await User.aggregate([
            { $match: match },
            {
                $group: {
                    _id: '$role',
                    count: { $sum: 1 },
                    active: {
                        $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
                    },
                    inactive: {
                        $sum: { $cond: [{ $eq: ['$status', 'inactive'] }, 1, 0] }
                    }
                }
            }
        ]);

        res.status(200).json({
            status: 'success',
            data: { stats }
        });
    })
};

module.exports = userController;