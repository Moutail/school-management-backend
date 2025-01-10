const User = require('../models/userModel');
const UserPreference = require('../models/userPreferenceModel');
const ActivityLog = require('../models/activityLogModel');
const TokenService = require('../services/tokenService');
const { AppError } = require('../utils/errors');
const { catchAsync } = require('../utils/errorHandlers');

// Helper function pour nettoyer le numéro de téléphone
const cleanPhoneNumber = (phoneNumber) => {
    if (!phoneNumber) return undefined;
    // Supprimer tous les espaces du numéro
    return phoneNumber.replace(/\s+/g, '');
};

const authController = {
    register: catchAsync(async (req, res) => {
        const { email, password, firstName, lastName, role, class: className, phoneNumber } = req.body;

        // Validation des données
        if (!email || !password || !firstName || !lastName) {
            throw new AppError('Tous les champs requis doivent être remplis', 400);
        }

        // Vérifier si l'utilisateur existe déjà
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            throw new AppError('Cet email est déjà utilisé', 400);
        }

        // Générer le username
        const username = email.split('@')[0].toLowerCase();

        // Si c'est un étudiant, trouver ou créer la classe
        let classId;
        if (role === 'student') {
            const Class = require('../models/classModel');
            let classDoc = await Class.findOne({ name: className });
            
            if (!classDoc) {
                classDoc = await Class.create({
                    name: className,
                    level: className,
                    academicYear: new Date().getFullYear().toString()
                });
            }
            classId = classDoc._id;
        }

         // Nettoyer le numéro de téléphone avant la création
         const cleanedPhoneNumber = cleanPhoneNumber(phoneNumber);
        // Créer l'utilisateur
        const user = await User.create({
            email,
            password,
            firstName,
            lastName,
            username,
            role: role || 'student',
            class: classId,
            phoneNumber: phoneNumber ? phoneNumber.trim() : undefined
        });

        // Créer les préférences
        await UserPreference.create({
            user: user._id,
            theme: 'system',
            language: 'fr',
            notifications: {
                email: true,
                push: true,
                types: ['COURSE', 'GRADE', 'ATTENDANCE', 'EVENT', 'ANNOUNCEMENT']
            }
        });

        // Logger l'activité
        await ActivityLog.logActivity({
            user: user._id,
            action: 'REGISTER',
            ip: req.ip,
            userAgent: req.get('user-agent')
        });

        // Générer les tokens avec TokenService
        const { accessToken, refreshToken } = TokenService.generateTokens(user._id);

        // Préparer la réponse
        const userResponse = user.toObject();
        delete userResponse.password;

        res.status(201).json({
            status: 'success',
            data: { 
                user: userResponse,
                token: accessToken,           // Token d'accès pour l'authentification
                refreshToken: refreshToken    // Token de rafraîchissement
            }
        });
    }),
    login: catchAsync(async (req, res) => {
        const { email, password } = req.body;
    
        // Validation des données
        if (!email || !password) {
            throw new AppError('Veuillez fournir un email et un mot de passe', 400);
        }
    
        // Rechercher l'utilisateur et vérifier le mot de passe
        const user = await User.findOne({ email })
            .select('+password');
    
        if (!user || !(await user.comparePassword(password))) {
            throw new AppError('Email ou mot de passe incorrect', 401);
        }
    
        // Vérifier si le compte est actif
        if (!user.isActive) {
            throw new AppError('Votre compte a été désactivé', 403);
        }
    
        // Logger l'activité
        await ActivityLog.logActivity({
            user: user._id,
            action: 'LOGIN',
            ip: req.ip,
            userAgent: req.get('user-agent')
        });
    
        // Générer les tokens avec TokenService
        const { accessToken, refreshToken } = TokenService.generateTokens(user._id);
    
        // Supprimer le mot de passe de la réponse
        const userResponse = user.toObject();
        delete userResponse.password;
    
        // Mettre à jour la dernière connexion
        await User.findByIdAndUpdate(user._id, {
            lastLogin: Date.now()
        });
    
        res.status(200).json({
            status: 'success',
            data: { 
                user: userResponse,
                token: accessToken,         // Token d'accès
                refreshToken: refreshToken  // Token de rafraîchissement
            }
        });
    }),

    logout: catchAsync(async (req, res) => {
        if (!req.user) {
            throw new AppError('Vous devez être connecté', 401);
        }

        await ActivityLog.logActivity({
            user: req.user._id,
            action: 'LOGOUT',
            ip: req.ip,
            userAgent: req.get('user-agent')
        });

        res.status(200).json({
            status: 'success',
            message: 'Déconnexion réussie'
        });
    }),

    forgotPassword: catchAsync(async (req, res) => {
        const { email } = req.body;

        if (!email) {
            throw new AppError('Veuillez fournir une adresse email', 400);
        }

        const user = await User.findOne({ email });
        if (!user) {
            throw new AppError('Aucun utilisateur trouvé avec cet email', 404);
        }

        const resetToken = await user.createPasswordResetToken();
        await user.save({ validateBeforeSave: false });

        await ActivityLog.logActivity({
            user: user._id,
            action: 'PASSWORD_RESET_REQUEST',
            ip: req.ip,
            userAgent: req.get('user-agent')
        });

        try {
            // TODO: Implémenter l'envoi d'email
            res.status(200).json({
                status: 'success',
                message: 'Token de réinitialisation envoyé par email'
            });
        } catch (error) {
            user.resetPasswordToken = undefined;
            user.resetPasswordExpires = undefined;
            await user.save({ validateBeforeSave: false });
            throw new AppError('Erreur lors de l\'envoi de l\'email', 500);
        }
    }),

    resetPassword: catchAsync(async (req, res) => {
        const { token } = req.params;
        const { password } = req.body;

        if (!password) {
            throw new AppError('Veuillez fournir un nouveau mot de passe', 400);
        }

        const user = await User.findOne({
            resetPasswordToken: token,
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!user) {
            throw new AppError('Token invalide ou expiré', 400);
        }

        user.password = password;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();

        await ActivityLog.logActivity({
            user: user._id,
            action: 'PASSWORD_RESET_COMPLETE',
            ip: req.ip,
            userAgent: req.get('user-agent')
        });

        const newToken = TokenService.generateToken(user._id, '24h');

        res.status(200).json({
            status: 'success',
            data: { 
                message: 'Mot de passe réinitialisé avec succès',
                token: newToken 
            }
        });
    }),

    verifyToken: catchAsync(async (req, res) => {
        const token = req.headers.authorization?.split(' ')[1];
        
        if (!token) {
            throw new AppError('Aucun token fourni', 401);
        }

        const decoded = TokenService.verifyToken(token);
        const user = await User.findById(decoded.userId);

        if (!user) {
            throw new AppError('Utilisateur non trouvé', 404);
        }

        res.status(200).json({
            status: 'success',
            data: {
                user: {
                    id: user._id,
                    email: user.email,
                    role: user.role
                }
            }
        });
    }),

    updatePassword: catchAsync(async (req, res) => {
        const { currentPassword, newPassword } = req.body;
        const user = await User.findById(req.user._id).select('+password');

        if (!(await user.comparePassword(currentPassword))) {
            throw new AppError('Mot de passe actuel incorrect', 401);
        }

        user.password = newPassword;
        await user.save();

        res.status(200).json({
            status: 'success',
            message: 'Mot de passe mis à jour avec succès'
        });
    })
};

module.exports = authController;