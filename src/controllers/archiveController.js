// src/controllers/archiveController.js
const mongoose = require('mongoose');
const { Archive } = require('../models');
const { AppError } = require('../utils/errors');
const { catchAsync } = require('../utils/errorHandlers');
const cache = require('../config/cache');

const getCacheKey = (year) => `archives:${year || 'all'}`;
const CACHE_DURATION = 300;

const archiveController = {
    // Get all archives
    getArchives: catchAsync(async (req, res) => {
        const { year, course, type, period } = req.query;
        const query = {};
        
        if (year) query.academicYear = year;
        if (course) query.course = course;
        if (type) query.type = type;
        if (period) query.period = period;

        const archives = await Archive.find(query)
            .populate('course', 'title code')
            .populate('period', 'name')
            .sort('-createdAt')
            .lean();

        const cacheKey = getCacheKey(year);
        await cache.set(cacheKey, JSON.stringify(archives), 'EX', CACHE_DURATION);

        res.json({
            status: 'success',
            results: archives.length,
            data: archives
        });
    }),

    // Search archives
    searchArchives: catchAsync(async (req, res) => {
        const { query = '', type, startYear, endYear } = req.query;
        const searchQuery = { $text: { $search: query } };
        
        if (type) searchQuery.type = type;
        if (startYear && endYear) {
            searchQuery.academicYear = { $gte: startYear, $lte: endYear };
        }

        const archives = await Archive.find(searchQuery)
            .populate('course', 'title code')
            .sort({ score: { $meta: 'textScore' } })
            .lean();

        res.json({
            status: 'success',
            results: archives.length,
            data: archives
        });
    }),

    // Get single archive
    getArchiveById: catchAsync(async (req, res) => {
        const archive = await Archive.findById(req.params.id)
            .populate('course', 'title code professor')
            .populate('period', 'name startDate endDate');

        if (!archive) {
            throw new AppError('Archive non trouvée', 404);
        }

        res.json({
            status: 'success',
            data: archive
        });
    }),

    // Create archive
    createArchive: catchAsync(async (req, res) => {
        const archive = await Archive.create(req.body);
        
        res.status(201).json({
            status: 'success',
            data: archive
        });
    }),

    // Update archive
    updateArchive: catchAsync(async (req, res) => {
        const archive = await Archive.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );

        if (!archive) {
            throw new AppError('Archive non trouvée', 404);
        }

        await cache.del(getCacheKey(archive.academicYear));

        res.json({
            status: 'success',
            data: archive
        });
    }),

    // Delete archive
    deleteArchive: catchAsync(async (req, res) => {
        const archive = await Archive.findByIdAndDelete(req.params.id);

        if (!archive) {
            throw new AppError('Archive non trouvée', 404);
        }

        await cache.del(getCacheKey(archive.academicYear));

        res.json({
            status: 'success',
            message: 'Archive supprimée avec succès'
        });
    }),

    // Add document
    addDocument: catchAsync(async (req, res) => {
        const archive = await Archive.findById(req.params.id);

        if (!archive) {
            throw new AppError('Archive non trouvée', 404);
        }

        archive.documents.push(req.body);
        await archive.save();

        res.json({
            status: 'success',
            data: archive
        });
    }),

    // Remove document
    removeDocument: catchAsync(async (req, res) => {
        const archive = await Archive.findById(req.params.id);

        if (!archive) {
            throw new AppError('Archive non trouvée', 404);
        }

        archive.documents = archive.documents.filter(
            doc => doc._id.toString() !== req.params.documentId
        );

        await archive.save();

        res.json({
            status: 'success',
            data: archive
        });
    }),

    // Get archives by course
    getArchivesByCourse: catchAsync(async (req, res) => {
        const archives = await Archive.find({ course: req.params.courseId })
            .populate('course', 'title code')
            .sort('-createdAt')
            .lean();

        res.json({
            status: 'success',
            results: archives.length,
            data: archives
        });
    }),

    // Get archives by year
    getArchivesByYear: catchAsync(async (req, res) => {
        const archives = await Archive.find({ academicYear: req.params.year })
            .populate('course', 'title code')
            .sort('-createdAt')
            .lean();

        res.json({
            status: 'success',
            results: archives.length,
            data: archives
        });
    }),

    // Get archive statistics
    getArchiveStats: catchAsync(async (req, res) => {
        const stats = await Archive.aggregate([
            {
                $group: {
                    _id: '$academicYear',
                    count: { $sum: 1 },
                    documentsCount: { $sum: { $size: '$documents' } }
                }
            },
            { $sort: { _id: -1 } }
        ]);

        res.json({
            status: 'success',
            data: stats
        });
    }),

    // Get single archive statistics
    getSingleArchiveStats: catchAsync(async (req, res) => {
        const archive = await Archive.findById(req.params.id);

        if (!archive) {
            throw new AppError('Archive non trouvée', 404);
        }

        const stats = {
            documentsCount: archive.documents.length,
            documentsPerType: archive.documents.reduce((acc, doc) => {
                acc[doc.type] = (acc[doc.type] || 0) + 1;
                return acc;
            }, {}),
            lastUpdated: archive.updatedAt
        };

        res.json({
            status: 'success',
            data: stats
        });
    })
};

module.exports = archiveController;