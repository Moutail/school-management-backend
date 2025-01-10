// backend/src/models/scheduleModel.js
const mongoose = require('mongoose');

const timeSlotSchema = new mongoose.Schema({
   startTime: {
       type: String,
       required: true
   },
   endTime: {
       type: String,
       required: true
   },
   course: {
       type: mongoose.Schema.Types.ObjectId,
       ref: 'Course',
       required: true
   },
   professor: {
       type: mongoose.Schema.Types.ObjectId,
       ref: 'User',
       required: true
   },
   room: {
       type: mongoose.Schema.Types.ObjectId,
       ref: 'Room',
       required: true
   },
   class: {
       type: mongoose.Schema.Types.ObjectId,
       ref: 'Class',
       required: true
   },
   type: {
       type: String,
       enum: ['COURSE', 'EXAM', 'EVENT'],
       default: 'COURSE'
   },
   day: {
       type: Number,
       required: true,
       min: 0,
       max: 6
   },
   recurring: {
       type: Boolean,
       default: true
   }
}, { timestamps: true });

timeSlotSchema.index({ startTime: 1, endTime: 1, room: 1, day: 1 });
timeSlotSchema.index({ professor: 1, day: 1 });
timeSlotSchema.index({ class: 1, day: 1 });

const roomSchema = new mongoose.Schema({
   name: {
       type: String,
       required: true,
       unique: true
   },
   capacity: {
       type: Number,
       required: true
   },
   available: {
       type: Boolean,
       default: true
   }
});
