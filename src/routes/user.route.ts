import express from 'express';
import {
    createUser,
    getUsers,
    getUserById,
    getOwnProfile,
    updateUser,
    updateOwnProfile,
    deleteUser
} from '../controllers/user.controller.js';
import { adminResetPassword } from '../controllers/auth.controller.js';
import {
    validateAdminCreateUser,
    validateUpdateUserProfile,
    validateUpdateOwnProfile,
    validateAdminResetPassword,
    validateUUIDParam,
    validatePagination
} from '../middleware/validation.js';
import { authenticateUser } from '../middleware/auth.js';
import authorizeRole from '../middleware/role.js';

const router = express.Router();

// All user routes require authentication
router.use(authenticateUser);

// Get own profile
router.get('/profile', getOwnProfile);

// Update own profile
router.put('/profile', validateUpdateOwnProfile, updateOwnProfile);

// Admin routes - require owner/manager role
router.post('/', authorizeRole('owner', 'manager'), validateAdminCreateUser, createUser);
router.get('/', authorizeRole('owner', 'manager'), validatePagination, getUsers);
router.get('/:id', authorizeRole('owner', 'manager'), validateUUIDParam('id'), getUserById);
router.put('/:id', authorizeRole('owner', 'manager'), validateUUIDParam('id'), validateUpdateUserProfile, updateUser);
router.put('/:id/password', authorizeRole('owner', 'manager'), validateUUIDParam('id'), validateAdminResetPassword, adminResetPassword);
router.delete('/:id', authorizeRole('owner', 'manager'), validateUUIDParam('id'), deleteUser);

export default router;

