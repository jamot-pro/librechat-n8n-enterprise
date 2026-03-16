const express = require('express');
const router = express.Router();
const profileAuth = require('../middleware/profileAuth');
const TaskController = require('../controllers/TaskController');

// All task routes require profile auth
router.use(profileAuth);

// Board + stats
router.get('/board', TaskController.getBoard);
router.get('/stats', TaskController.getStats);
router.get('/users', TaskController.searchUsers);

// Task CRUD
router.get('/', TaskController.listTasks);
router.post('/', TaskController.createTask);
router.get('/:taskId', TaskController.getTask);
router.put('/:taskId', TaskController.updateTask);
router.patch('/:taskId/status', TaskController.updateStatus);
router.patch('/:taskId/assign', TaskController.assignTask);
router.post('/:taskId/comments', TaskController.addComment);
router.delete('/:taskId', TaskController.deleteTask);

module.exports = router;
