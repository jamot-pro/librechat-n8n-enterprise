const express = require('express');
const router = express.Router();
const profileAuth = require('../middleware/profileAuth');
const DivineController = require('../controllers/DivineController');

router.use(profileAuth);

// Chat
router.post('/chat', DivineController.chat);
router.get('/history', DivineController.getHistory);
router.delete('/history', DivineController.clearHistory);

// Autonomous action log (CEO only)
router.get('/events/stats', DivineController.getEventStats);
router.get('/events', DivineController.getEvents);

// In-app notifications
router.get('/notifications', DivineController.getNotifications);
router.patch('/notifications/read-all', DivineController.markAllNotificationsRead);
router.patch('/notifications/:id/read', DivineController.markNotificationRead);

module.exports = router;
