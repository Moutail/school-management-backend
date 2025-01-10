// backend/src/models/documentModel.js
const mongoose = require('mongoose');

const downloadSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    downloadedAt: {
        type: Date,
        default: Date.now
    },
    ip: String,
    userAgent: String
}, { _id: false });

const documentSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Le titre est requis'],
        trim: true,
        maxlength: [200, 'Le titre ne peut pas dépasser 200 caractères']
    },
    type: {
        type: String,
        enum: {
            values: ['COURSE', 'EXERCISE', 'RESOURCE', 'HOMEWORK'],
            message: '{VALUE} n\'est pas un type valide'
        },
        required: [true, 'Le type est requis']
    },
    description: {
        type: String,
        trim: true,
        maxlength: [1000, 'La description ne peut pas dépasser 1000 caractères']
    },
    file: {
        type: String,
        required: [true, 'Le fichier est requis']
    },
    course: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Course',
        required: [true, 'Le cours est requis'],
        index: true
    },
    chapter: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Chapter',
        index: true
    },
    academicPeriod: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'AcademicPeriod',
        required: [true, 'La période académique est requise'],
        index: true
    },
    uploadedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'L\'utilisateur est requis'],
        index: true
    },
    visibility: {
        type: String,
        enum: ['ALL', 'SPECIFIC_GROUPS'],
        default: 'ALL'
    },
    targetGroups: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Group'
    }],
    status: {
        type: String,
        enum: ['ACTIVE', 'ARCHIVED', 'HIDDEN'],
        default: 'ACTIVE'
    },
    metadata: {
        size: Number,
        mimeType: String,
        originalName: String,
        extension: String
    },
    downloads: [downloadSchema],
    downloadCount: {
        type: Number,
        default: 0
    },
    lastDownloadedAt: Date,
    tags: [{
        type: String,
        trim: true
    }],
    order: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Indexes
documentSchema.index({ course: 1, type: 1 });
documentSchema.index({ course: 1, academicPeriod: 1 });
documentSchema.index({ title: 'text', description: 'text', tags: 'text' });

// Virtuals
documentSchema.virtual('downloadStats').get(function() {
    return {
        total: this.downloadCount,
        unique: this.downloads ? new Set(this.downloads.map(d => d.user.toString())).size : 0,
        lastDownload: this.lastDownloadedAt
    };
});

documentSchema.virtual('fileExtension').get(function() {
    return this.metadata?.extension || this.file.split('.').pop();
});

// Methods
documentSchema.methods.isAccessibleBy = function(user) {
    if (this.status === 'HIDDEN' && user.role !== 'admin') {
        return false;
    }
    
    if (this.visibility === 'ALL') {
        return true;
    }

    if (this.visibility === 'SPECIFIC_GROUPS' && this.targetGroups) {
        return user.groups.some(group => 
            this.targetGroups.includes(group.toString())
        );
    }

    return false;
};

documentSchema.methods.addDownload = async function(user, details = {}) {
    this.downloads.push({
        user: user._id,
        ip: details.ip,
        userAgent: details.userAgent
    });
    
    this.downloadCount += 1;
    this.lastDownloadedAt = new Date();
    
    return this.save();
};

// Statics
documentSchema.statics.getDocumentsByPeriod = function(periodId) {
    return this.find({ 
        academicPeriod: periodId,
        status: 'ACTIVE'
    }).sort({ order: 1, createdAt: -1 });
};

documentSchema.statics.getStudentAccessibleDocuments = function(courseId, student) {
    return this.find({
        course: courseId,
        status: 'ACTIVE',
        $or: [
            { visibility: 'ALL' },
            {
                visibility: 'SPECIFIC_GROUPS',
                targetGroups: { $in: student.groups }
            }
        ]
    }).sort({ order: 1, createdAt: -1 });
};

// Middleware
documentSchema.pre('save', function(next) {
    // Définir l'extension si elle n'existe pas
    if (!this.metadata?.extension && this.file) {
        this.metadata = {
            ...this.metadata,
            extension: this.file.split('.').pop()
        };
    }

    // Valider les groupes cibles si la visibilité est spécifique
    if (this.visibility === 'SPECIFIC_GROUPS' && 
        (!this.targetGroups || this.targetGroups.length === 0)) {
        next(new Error('Les groupes cibles sont requis pour la visibilité spécifique'));
    }

    next();
});

// Supprimer les téléchargements associés lors de la suppression
documentSchema.pre('remove', async function(next) {
    // Ici vous pouvez ajouter la logique pour nettoyer les fichiers stockés
    next();
});

const Document = mongoose.model('Document', documentSchema);

module.exports = Document;