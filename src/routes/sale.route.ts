import express from 'express';
import {
    createSale,
    getSales,
    getSaleById,
    deleteSale,
} from '../controllers/sale.controller.js';
import {
    validateCreateSale,
    validateUUIDParam,
    validatePagination,
} from '../middleware/validation.js';
import { authenticateUser } from '../middleware/auth.js';
import authorizeRole from '../middleware/role.js';

const router = express.Router();

// All sale routes require authentication
router.use(authenticateUser);

// Public endpoints (authenticated users can view)
router.get('/', validatePagination, getSales);
router.get('/:id', validateUUIDParam('id'), getSaleById);

// Protected endpoints (cashiers+ can create, owner/manager can delete)
router.post('/', authorizeRole('owner', 'manager', 'cashier'), validateCreateSale, createSale);
router.delete('/:id', authorizeRole('owner', 'manager'), validateUUIDParam('id'), deleteSale);

export default router;


