// backend/src/models/tokenModel.js
const mongoose = require('mongoose');

const tokenSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User'
    },
    token: {
        type: String,
        required: true,
        unique: true // Ajout d'index unique
    },
    expires: {
        type: Date,
        default: () => Date.now() + 7*24*60*60*1000,
        index: { expires: 0 } // Nettoyage automatique des tokens expirés
    }
}, {
    timestamps: true // Ajout des timestamps
});

// Index composé pour des recherches plus rapides
tokenSchema.index({ userId: 1, token: 1 });

module.exports = mongoose.model('Token', tokenSchema);