// backend/src/models/userModel.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const validator = require('validator');
const crypto = require('crypto');

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: [true, 'Le nom d\'utilisateur est requis'],
        unique: true,
        trim: true,
        minlength: [3, 'Le nom d\'utilisateur doit contenir au moins 3 caractères'],
        maxlength: [50, 'Le nom d\'utilisateur ne peut pas dépasser 50 caractères']
    },
    email: {
        type: String,
        required: [true, 'L\'email est requis'],
        unique: true,
        trim: true,
        lowercase: true,
        validate: [validator.isEmail, 'Email invalide']
    },
    password: {
        type: String,
        required: [true, 'Le mot de passe est requis'],
        minlength: [8, 'Le mot de passe doit contenir au moins 8 caractères'],
        select: false // Ne pas inclure par défaut dans les requêtes
    },
    role: {
        type: String,
        enum: {
            values: ['admin', 'professor', 'student', 'parent', 'major'],
            message: 'Rôle non valide'
        },
        required: true
    },
    firstName: {
        type: String,
        required: [true, 'Le prénom est requis'],
        trim: true,
        maxlength: [50, 'Le prénom ne peut pas dépasser 50 caractères']
    },
    lastName: {
        type: String,
        required: [true, 'Le nom est requis'],
        trim: true,
        maxlength: [50, 'Le nom ne peut pas dépasser 50 caractères']
    },
    profileImage: {
        type: String,
        validate: {
            validator: function(v) {
                if (!v) return true;
                return validator.isURL(v);
            },
            message: 'URL d\'image invalide'
        }
    },
    phoneNumber: {
        type: String,
        validate: {
            validator: function(v) {
                if (!v) return true;
                return validator.isMobilePhone(v);
            },
            message: 'Numéro de téléphone invalide'
        }
    },
    isActive: {
        type: Boolean,
        default: true
    },
    // Dans votre userModel.js, ajoutez ces champs au schéma
    isBlocked: {
      type: Boolean,
      default: false
    },
    blockEndDate: {
      type: Date,
      default: null
    },
    lastLogin: Date,
    resetPasswordToken: String,
    resetPasswordExpires: Date,
    class: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Class',
        required: function() { 
            return this.role === 'student' || this.role === 'major';
        }
    },
    children: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        validate: {
            validator: function(v) {
                return this.role !== 'parent' || v.length > 0;
            },
            message: 'Un parent doit avoir au moins un enfant associé'
        }
    }],
    teachingSubjects: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Course',
        validate: {
            validator: function(v) {
                return this.role !== 'professor' || v.length > 0;
            },
            message: 'Un professeur doit avoir au moins une matière associée'
        }
    }]
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Index composés pour les recherches fréquentes
userSchema.index({ email: 1, role: 1 });
userSchema.index({ class: 1, role: 1 });
userSchema.index({ 'children': 1 }, { sparse: true });
userSchema.index({ username: 'text', firstName: 'text', lastName: 'text' });

// Virtual populate pour les cours d'un étudiant
userSchema.virtual('enrolledCourses', {
    ref: 'Course',
    localField: '_id',
    foreignField: 'students'
});

// Virtual populate pour les présences d'un étudiant
userSchema.virtual('attendanceRecords', {
    ref: 'Attendance',
    localField: '_id',
    foreignField: 'student'
});

// Hash le mot de passe avant la sauvegarde
userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Méthode pour comparer les mots de passe
userSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

// Méthode pour créer un token de réinitialisation de mot de passe
userSchema.methods.createPasswordResetToken = function() {
    const resetToken = crypto.randomBytes(32).toString('hex');
    this.resetPasswordToken = crypto
        .createHash('sha256')
        .update(resetToken)
        .digest('hex');
    
    this.resetPasswordExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
    return resetToken;
};

// IMPORTANT: Ajoutez cette ligne à la fin du fichier
module.exports = mongoose.model('User', userSchema);