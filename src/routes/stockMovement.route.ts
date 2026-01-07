import express from 'express';
import {
    createStockAdjustment,
    getStockMovements,
    getStockMovementsByProduct,
    getStockMovementById,
} from '../controllers/stockMovement.controller.js';
import {
    validateCreateStockMovement,
    validateUUIDParam,
    validatePagination,
} from '../middleware/validation.js';
import { authenticateUser } from '../middleware/auth.js';
import authorizeRole from '../middleware/role.js';

const router = express.Router();

// All stock movement routes require authentication
router.use(authenticateUser);

// Public endpoints (authenticated users can view)
router.get('/', validatePagination, getStockMovements);
router.get('/product/:product_id', validateUUIDParam('product_id'), validatePagination, getStockMovementsByProduct);
router.get('/:id', validateUUIDParam('id'), getStockMovementById);

// Protected endpoints (only owner/manager can create adjustments)
router.post('/adjustment', authorizeRole('owner', 'manager'), validateCreateStockMovement, createStockAdjustment);

export default router;

