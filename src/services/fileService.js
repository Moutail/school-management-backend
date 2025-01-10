// src/services/fileService.js
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');
const { AppError } = require('../middleware/errorHandler');

class FileService {
    constructor() {
        this.baseUploadPath = path.join(__dirname, '../../uploads');
        this.maxFileSize = 10 * 1024 * 1024; // 10MB
        this.allowedMimeTypes = {
            'image/jpeg': 'jpg',
            'image/png': 'png',
            'image/gif': 'gif',
            'application/pdf': 'pdf',
            'application/msword': 'doc',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
            'application/vnd.ms-excel': 'xls',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx'
        };
    }

    // Configuration Multer
    configureUpload(options = {}) {
        const storage = multer.diskStorage({
            destination: async (req, file, cb) => {
                const uploadDir = options.directory ? 
                    path.join(this.baseUploadPath, options.directory) : 
                    this.baseUploadPath;

                try {
                    await fs.mkdir(uploadDir, { recursive: true });
                    cb(null, uploadDir);
                } catch (error) {
                    cb(error);
                }
            },
            filename: (req, file, cb) => {
                const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
                cb(null, uniqueName);
            }
        });

        const fileFilter = (req, file, cb) => {
            if (!this.allowedMimeTypes[file.mimetype]) {
                cb(new AppError('Type de fichier non autorisé', 400), false);
                return;
            }
            cb(null, true);
        };

        return multer({
            storage,
            fileFilter,
            limits: {
                fileSize: options.maxSize || this.maxFileSize
            }
        });
    }

    // Validation des fichiers
    async validateFile(file) {
        const errors = [];

        // Vérification de la taille
        if (file.size > this.maxFileSize) {
            errors.push('Le fichier est trop volumineux');
        }

        // Vérification du type MIME
        if (!this.allowedMimeTypes[file.mimetype]) {
            errors.push('Type de fichier non autorisé');
        }

        // Vérification de l'extension
        const ext = path.extname(file.originalname).toLowerCase();
        const allowedExt = `.${this.allowedMimeTypes[file.mimetype]}`;
        if (ext !== allowedExt) {
            errors.push('Extension de fichier invalide');
        }

        return errors;
    }

    // Sauvegarde du fichier
    async saveFile(file, directory = '') {
        try {
            const uploadDir = path.join(this.baseUploadPath, directory);
            await fs.mkdir(uploadDir, { recursive: true });

            const fileName = `${uuidv4()}${path.extname(file.originalname)}`;
            const filePath = path.join(uploadDir, fileName);

            await fs.writeFile(filePath, file.buffer);

            return {
                fileName,
                filePath: path.join(directory, fileName),
                mimeType: file.mimetype,
                size: file.size
            };
        } catch (error) {
            throw new AppError('Erreur lors de la sauvegarde du fichier', 500);
        }
    }

    // Suppression de fichier
    async deleteFile(filePath) {
        try {
            const fullPath = path.join(this.baseUploadPath, filePath);
            await fs.unlink(fullPath);
            return true;
        } catch (error) {
            if (error.code === 'ENOENT') {
                return false; // Fichier déjà supprimé ou inexistant
            }
            throw error;
        }
    }

    // Récupération d'un fichier
    async getFile(filePath) {
        try {
            const fullPath = path.join(this.baseUploadPath, filePath);
            const file = await fs.readFile(fullPath);
            const stats = await fs.stat(fullPath);
            return {
                file,
                size: stats.size,
                mimeType: this.getMimeType(path.extname(filePath))
            };
        } catch (error) {
            if (error.code === 'ENOENT') {
                throw new AppError('Fichier non trouvé', 404);
            }
            throw error;
        }
    }

    // Gestion des fichiers temporaires
    async cleanTempFiles(olderThan = 24 * 60 * 60 * 1000) { // 24 heures par défaut
        try {
            const tempDir = path.join(this.baseUploadPath, 'temp');
            const files = await fs.readdir(tempDir);
            const now = Date.now();

            for (const file of files) {
                const filePath = path.join(tempDir, file);
                const stats = await fs.stat(filePath);
                const age = now - stats.mtime.getTime();

                if (age > olderThan) {
                    await fs.unlink(filePath);
                }
            }
        } catch (error) {
            console.error('Erreur lors du nettoyage des fichiers temporaires:', error);
        }
    }

    // Utilitaires
    getMimeType(extension) {
        const ext = extension.toLowerCase().replace('.', '');
        for (const [mime, fileExt] of Object.entries(this.allowedMimeTypes)) {
            if (fileExt === ext) return mime;
        }
        return 'application/octet-stream';
    }
}

module.exports = new FileService();