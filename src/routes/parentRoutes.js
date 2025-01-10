// routes/parentRoutes.js
const express = require('express');
const router = express.Router();
const parentController = require('../controllers/parentController');
const { protect } = require('../middleware/authMiddleware');
const checkRole = require('../middleware/roleMiddleware');

router.use(protect);
router.use(checkRole(['parent']));

router.get('/children', parentController.getChildren);
router.get('/children/:childId/stats', parentController.getChildStats);
router.get('/children/:childId/schedule', parentController.getChildSchedule);
router.get('/children/:childId/attendance', parentController.getChildAttendance);
router.get('/children/:childId/activities', parentController.getChildActivities);

module.exports = router;