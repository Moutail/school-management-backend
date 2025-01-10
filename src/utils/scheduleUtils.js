// src/utils/scheduleUtils.js
const mongoose = require('mongoose');

// Définition des schémas
const timeSlotSchema = new mongoose.Schema({
    room: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Room',
        required: true
    },
    professor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    course: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Course',
        required: true
    },
    day: {
        type: Number,
        required: true,
        min: 0,
        max: 6
    },
    startTime: {
        type: String,
        required: true,
        match: /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/
    },
    endTime: {
        type: String,
        required: true,
        match: /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/
    },
    type: {
        type: String,
        enum: ['COURSE', 'EXAM', 'EVENT'],
        default: 'COURSE'
    },
    status: {
        type: String,
        enum: ['SCHEDULED', 'CANCELLED', 'COMPLETED'],
        default: 'SCHEDULED'
    },
    recurrence: {
        type: {
            type: String,
            enum: ['WEEKLY', 'BIWEEKLY', 'MONTHLY']
        },
        until: Date
    }
}, {
    timestamps: true
});

const roomSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true
    },
    capacity: {
        type: Number,
        required: true,
        min: 1
    },
    building: {
        type: String,
        required: true
    },
    floor: {
        type: Number,
        required: true
    },
    facilities: [{
        type: String,
        enum: ['PROJECTOR', 'COMPUTER', 'WHITEBOARD', 'SMARTBOARD', 'AC']
    }],
    status: {
        type: String,
        enum: ['AVAILABLE', 'MAINTENANCE', 'OUT_OF_SERVICE'],
        default: 'AVAILABLE'
    }
}, {
    timestamps: true
});

// Modèles
const TimeSlot = mongoose.model('TimeSlot', timeSlotSchema);
const Room = mongoose.model('Room', roomSchema);

// Fonction de vérification des conflits
const checkConflicts = async (slotData) => {
    const conflicts = [];
    
    const roomConflicts = await TimeSlot.find({
        room: slotData.room,
        day: slotData.day,
        status: 'SCHEDULED',
        $or: [
            {
                startTime: { $lt: slotData.endTime },
                endTime: { $gt: slotData.startTime }
            }
        ]
    });
 
    if (roomConflicts.length > 0) {
        conflicts.push({
            type: 'ROOM',
            message: 'Salle déjà occupée sur ce créneau',
            slots: roomConflicts
        });
    }
 
    const professorConflicts = await TimeSlot.find({
        professor: slotData.professor,
        day: slotData.day,
        status: 'SCHEDULED',
        $or: [
            {
                startTime: { $lt: slotData.endTime },
                endTime: { $gt: slotData.startTime }
            }
        ]
    });
 
    if (professorConflicts.length > 0) {
        conflicts.push({
            type: 'PROFESSOR',
            message: 'Professeur déjà occupé sur ce créneau',
            slots: professorConflicts
        });
    }
 
    return conflicts;
};

// Export des utilitaires
module.exports = {
    TimeSlot,
    Room,
    checkConflicts
};