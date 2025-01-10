// src/models/analyticsModel.js
const mongoose = require('mongoose');

const performanceSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  class: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
    required: true
  },
  subject: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subject',
    required: true
  },
  grades: [{
    value: Number,
    date: Date,
    type: String
  }],
  averages: {
    trimester1: Number,
    trimester2: Number,
    trimester3: Number,
    yearly: Number
  },
  progress: {
    trend: Number,
    improvements: [String],
    challenges: [String]
  }
}, {
  timestamps: true
});

const PerformanceAnalytics = mongoose.model('PerformanceAnalytics', performanceSchema);

module.exports = PerformanceAnalytics;