import express from 'express';
import {
    createPurchase,
    getPurchases,
    getPurchaseById,
    updatePurchasePaymentStatus,
    deletePurchase,
} from '../controllers/purchase.controller.js';
import {
    validateCreatePurchase,
    validateUUIDParam,
    validatePagination,
} from '../middleware/validation.js';
import { authenticateUser } from '../middleware/auth.js';
import authorizeRole from '../middleware/role.js';
import { PaymentStatus } from '../types/model.types.js';
import { body } from 'express-validator';
import { handleValidationErrors } from '../middleware/validation.js';

const router = express.Router();

// All purchase routes require authentication
router.use(authenticateUser);

// Public endpoints (authenticated users can view)
router.get('/', validatePagination, getPurchases);
router.get('/:id', validateUUIDParam('id'), getPurchaseById);

// Protected endpoints (only owner/manager can create/edit/delete)
router.post('/', authorizeRole('owner', 'manager'), validateCreatePurchase, createPurchase);
router.patch('/:id/payment-status', authorizeRole('owner', 'manager'), validateUUIDParam('id'), [
    body('payment_status')
        .notEmpty()
        .withMessage('payment_status is required')
        .isIn(Object.values(PaymentStatus))
        .withMessage(`payment_status must be one of: ${Object.values(PaymentStatus).join(', ')}`),
    handleValidationErrors
], updatePurchasePaymentStatus);
router.delete('/:id', authorizeRole('owner', 'manager'), validateUUIDParam('id'), deletePurchase);

export default router;

