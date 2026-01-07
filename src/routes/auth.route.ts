import express from 'express';
import { login, logout, changePassword, requestPasswordReset, resetPassword, refreshToken } from '../controllers/auth.controller.js';
import { validateLogin, validateChangePassword, validateRequestPasswordReset, validateResetPassword, validateRefreshToken } from '../middleware/validation.js';
import { authenticateUser } from '../middleware/auth.js';

const router = express.Router();

// Public endpoints
router.post('/login', validateLogin, login);
router.post('/refresh', validateRefreshToken, refreshToken);
router.post('/forgot-password', validateRequestPasswordReset, requestPasswordReset);
router.post('/reset-password', validateResetPassword, resetPassword);

// Protected endpoints - require authentication
router.use(authenticateUser);
router.post('/logout', logout);
router.put('/password', validateChangePassword, changePassword);

export default router;