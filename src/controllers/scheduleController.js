// src/controllers/scheduleController.js
const mongoose = require('mongoose');
const { TimeSlot, Room } = require('../models/scheduleModel');
const { checkConflicts, generateRecurrentSlots } = require('../utils/scheduleUtils');
const { AppError } = require('../utils/errors');
const { catchAsync } = require('../utils/errorHandlers');
const { notifyParticipants } = require('../utils/notifications');

const scheduleController = {
    // Obtenir tous les créneaux horaires
    getTimeSlots: catchAsync(async (req, res) => {
        const { type, classId, professorId, startDate, endDate, roomId, courseId } = req.query;
        const query = {};

        if (type) query.type = type;
        if (classId) query.class = classId;
        if (professorId) query.professor = professorId;
        if (roomId) query.room = roomId;
        if (courseId) query.course = courseId;

        if (startDate || endDate) {
            query.date = {};
            if (startDate) query.date.$gte = new Date(startDate);
            if (endDate) query.date.$lte = new Date(endDate);
        }

        const slots = await TimeSlot.find(query)
            .populate('course', 'title code')
            .populate('professor', 'firstName lastName')
            .populate('room', 'name capacity')
            .populate('class', 'name')
            .sort('date startTime');

        res.status(200).json({
            status: 'success',
            results: slots.length,
            data: { slots }
        });
    }),

    // Créer un nouveau créneau horaire
    createTimeSlot: catchAsync(async (req, res) => {
        // Vérifier les conflits
        const conflicts = await checkConflicts(req.body);
        if (conflicts.length > 0) {
            throw new AppError('Conflits détectés dans l\'emploi du temps', 400, { conflicts });
        }

        // Créer le créneau
        const timeSlot = await TimeSlot.create({
            ...req.body,
            createdBy: req.user._id
        });

        // Si récurrent, générer les créneaux récurrents
        if (req.body.recurrence) {
            await generateRecurrentSlots(timeSlot);
        }

        const populatedSlot = await TimeSlot.findById(timeSlot._id)
            .populate('course', 'title code')
            .populate('professor', 'firstName lastName')
            .populate('room', 'name')
            .populate('class', 'name');

        // Notifier les participants
        await notifyParticipants({
            type: 'NEW_SCHEDULE',
            slot: populatedSlot
        });

        res.status(201).json({
            status: 'success',
            data: { slot: populatedSlot }
        });
    }),

    // Vérifier les conflits
    checkConflicts: catchAsync(async (req, res) => {
        const conflicts = await checkConflicts(req.body);
        
        res.status(200).json({
            status: 'success',
            data: { conflicts }
        });
    }),

    // Obtenir les salles disponibles
    getRooms: catchAsync(async (req, res) => {
        const { date, startTime, endTime, capacity, features } = req.query;
        const query = {};

        if (capacity) query.capacity = { $gte: parseInt(capacity) };
        if (features) {
            query.facilities = { $all: Array.isArray(features) ? features : [features] };
        }

        let rooms = await Room.find(query);

        // Si date et heures spécifiées, filtrer les salles occupées
        if (date && startTime && endTime) {
            const occupiedRoomIds = await TimeSlot.distinct('room', {
                date: new Date(date),
                $or: [
                    {
                        startTime: { $lt: endTime },
                        endTime: { $gt: startTime }
                    }
                ],
                status: 'SCHEDULED'
            });

            rooms = rooms.filter(room => 
                !occupiedRoomIds.includes(room._id)
            );
        }

        res.status(200).json({
            status: 'success',
            results: rooms.length,
            data: { rooms }
        });
    }),

    // Obtenir l'emploi du temps d'une classe
    getClassSchedule: catchAsync(async (req, res) => {
        const slots = await TimeSlot.find({ 
            class: req.params.classId,
            ...buildTimeSlotQuery(req.query)
        })
        .populate('course', 'title code')
        .populate('professor', 'firstName lastName')
        .populate('room', 'name')
        .sort('date startTime');

        res.status(200).json({
            status: 'success',
            results: slots.length,
            data: { slots }
        });
    }),

    // Obtenir l'emploi du temps d'un professeur
    getProfessorSchedule: catchAsync(async (req, res) => {
        const slots = await TimeSlot.find({ 
            professor: req.params.professorId,
            ...buildTimeSlotQuery(req.query)
        })
        .populate('course', 'title code')
        .populate('class', 'name')
        .populate('room', 'name')
        .sort('date startTime');

        res.status(200).json({
            status: 'success',
            results: slots.length,
            data: { slots }
        });
    }),

    // Mettre à jour un créneau
    updateTimeSlot: catchAsync(async (req, res) => {
        const { slotId } = req.params;
        const existingSlot = await TimeSlot.findById(slotId);

        if (!existingSlot) {
            throw new AppError('Créneau non trouvé', 404);
        }

        if (req.user.role !== 'admin' && 
            existingSlot.professor.toString() !== req.user._id.toString()) {
            throw new AppError('Non autorisé à modifier ce créneau', 403);
        }

        // Vérifier les conflits si nécessaire
        if (req.body.startTime || req.body.endTime || req.body.date || req.body.room) {
            const conflicts = await checkConflicts({
                ...existingSlot.toObject(),
                ...req.body,
                excludeSlotId: slotId
            });

            if (conflicts.length > 0) {
                throw new AppError('Conflits détectés', 400, { conflicts });
            }
        }

        const updatedSlot = await TimeSlot.findByIdAndUpdate(
            slotId,
            {
                ...req.body,
                updatedBy: req.user._id
            },
            { new: true, runValidators: true }
        )
        .populate('course', 'title code')
        .populate('professor', 'firstName lastName')
        .populate('room', 'name')
        .populate('class', 'name');

        await notifyParticipants({
            type: 'SCHEDULE_UPDATED',
            slot: updatedSlot,
            changes: req.body
        });

        res.status(200).json({
            status: 'success',
            data: { slot: updatedSlot }
        });
    }),

    // Annuler un créneau
    cancelTimeSlot: catchAsync(async (req, res) => {
        const { slotId } = req.params;
        const { reason, notify } = req.body;

        const slot = await TimeSlot.findById(slotId)
            .populate('course', 'title code')
            .populate('professor', 'firstName lastName')
            .populate('class', 'name');

        if (!slot) {
            throw new AppError('Créneau non trouvé', 404);
        }

        if (req.user.role !== 'admin' && 
            slot.professor.toString() !== req.user._id.toString()) {
            throw new AppError('Non autorisé à annuler ce créneau', 403);
        }

        slot.status = 'CANCELLED';
        slot.cancellation = {
            reason,
            cancelledBy: req.user._id,
            cancelledAt: new Date()
        };
        await slot.save();

        if (notify) {
            await notifyParticipants({
                type: 'SCHEDULE_CANCELLED',
                slot,
                reason
            });
        }

        res.status(200).json({
            status: 'success',
            data: { slot }
        });
    }),

    // Obtenir les statistiques des salles
    getRoomStats: catchAsync(async (req, res) => {
        const { startDate, endDate, roomId } = req.query;
        const match = {};

        if (roomId) {
            match.room = mongoose.Types.ObjectId(roomId);
        }
        if (startDate || endDate) {
            match.date = {};
            if (startDate) match.date.$gte = new Date(startDate);
            if (endDate) match.date.$lte = new Date(endDate);
        }

        const stats = await TimeSlot.aggregate([
            { $match: match },
            {
                $group: {
                    _id: '$room',
                    totalSlots: { $sum: 1 },
                    totalHours: {
                        $sum: {
                            $divide: [
                                { $subtract: [
                                    { $toDate: '$endTime' },
                                    { $toDate: '$startTime' }
                                ]},
                                3600000
                            ]
                        }
                    },
                    typeDistribution: { $push: '$type' },
                    cancelledSlots: {
                        $sum: { $cond: [{ $eq: ['$status', 'CANCELLED'] }, 1, 0] }
                    }
                }
            },
            {
                $lookup: {
                    from: 'rooms',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'roomInfo'
                }
            },
            { $unwind: '$roomInfo' }
        ]);

        res.status(200).json({
            status: 'success',
            data: { stats }
        });
    })
};

// Fonction utilitaire pour construire la requête de créneaux
function buildTimeSlotQuery(queryParams) {
    const query = {};
    
    if (queryParams.startDate || queryParams.endDate) {
        query.date = {};
        if (queryParams.startDate) query.date.$gte = new Date(queryParams.startDate);
        if (queryParams.endDate) query.date.$lte = new Date(queryParams.endDate);
    }
    
    if (queryParams.type) query.type = queryParams.type;
    if (queryParams.courseId) query.course = queryParams.courseId;
    
    return query;
}

module.exports = scheduleController;