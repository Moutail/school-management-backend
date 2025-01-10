// src/routes/archiveRoutes.js
const express = require('express');
const router = express.Router();
const Joi = require('joi');

// Correction de l'import du middleware auth
const { protect } = require('../middleware/authMiddleware'); // Changé auth en protect
const checkRole = require('../middleware/roleMiddleware');
const archiveController = require('../controllers/archiveController');
const { validate, schemas } = require('../middleware/validation');
const cache = require('../config/cache');
const { catchAsync } = require('../utils/errorHandlers');

// Debug logs
console.log('protect:', protect);
console.log('checkRole:', checkRole);
console.log('validate:', validate);
console.log('archiveController:', archiveController);

// Route de test
router.get('/test', (req, res) => {
    res.json({ message: 'Test route works' });
});

// Routes spécifiques
router.get('/search', protect, checkRole(['admin', 'professor']), archiveController.searchArchives);

router.get('/stats', protect, checkRole(['admin']), archiveController.getArchiveStats);

router.get('/by-course/:courseId', protect, checkRole(['admin', 'professor']), archiveController.getArchivesByCourse);

router.get('/by-year/:year', protect, checkRole(['admin', 'professor']), archiveController.getArchivesByYear);

// Route principale
router.get('/', protect, checkRole(['admin', 'professor']), archiveController.getArchives);

// Routes avec ID
router.get('/:id', protect, checkRole(['admin', 'professor']), archiveController.getArchiveById);

router.put('/:id', protect, checkRole(['admin']), archiveController.updateArchive);

router.delete('/:id', protect, checkRole(['admin']), archiveController.deleteArchive);

// Routes de documents
router.post('/:id/documents', protect, checkRole(['admin']), archiveController.addDocument);

router.delete('/:id/documents/:documentId', protect, checkRole(['admin']), archiveController.removeDocument);

module.exports = router;