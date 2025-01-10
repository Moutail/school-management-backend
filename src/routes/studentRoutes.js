// routes/studentRoutes.js
const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController');
const { protect } = require('../middleware/authMiddleware');
const checkRole = require('../middleware/roleMiddleware');

// Appliquer les middlewares de protection à toutes les routes
router.use(protect);
router.use(checkRole(['student']));

// Routes du dashboard étudiant
router.get(
    '/dashboard/stats', 
    studentController.getDashboardStats
);

router.get(
    '/dashboard/activities', 
    studentController.getDashboardActivities
);

router.get(
    '/dashboard/schedule', 
    studentController.getDashboardSchedule
);

// Assurez-vous que toutes ces fonctions existent dans studentController.js
console.log('Student Controller Functions:', {
    stats: !!studentController.getDashboardStats,
    activities: !!studentController.getDashboardActivities,
    schedule: !!studentController.getDashboardSchedule
});

module.exports = router;