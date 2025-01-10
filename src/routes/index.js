// src/routes/index.js
const authRoutes = require('./authRoutes');
const userRoutes = require('./userRoutes');
const academicRoutes = require('./academicRoutes');
const blockingRoutes = require('./blockingRoutes');
const majorRoutes = require('./majorRoutes');
const documentRoutes = require('./documentRoutes');
const notificationRoutes = require('./notificationRoutes');
const archiveRoutes = require('./archiveRoutes');
const adminRoutes = require('./adminRoutes');
const scheduleRoutes = require('./scheduleRoutes');
const attendanceRoutes = require('./attendanceRoutes');
const courseRoutes = require('./courseRoutes');

module.exports = {
    authRoutes,
    userRoutes,
    academicRoutes,
    blockingRoutes,
    majorRoutes,
    documentRoutes,
    notificationRoutes,
    archiveRoutes,
    adminRoutes,
    scheduleRoutes,
    attendanceRoutes,
    courseRoutes
};