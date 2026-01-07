import express from 'express';
import {
    getInventory,
    getInventoryByProduct,
    getLowStockInventory,
    getInventoryValue,
} from '../controllers/inventory.controller.js';
import {
    validateUUIDParam,
    validatePagination,
} from '../middleware/validation.js';
import { authenticateUser } from '../middleware/auth.js';

const router = express.Router();

// All inventory routes require authentication
router.use(authenticateUser);

// Public endpoints (authenticated users can view)
router.get('/', validatePagination, getInventory);
router.get('/low-stock', validatePagination, getLowStockInventory);
router.get('/value', getInventoryValue);
router.get('/:product_id', validateUUIDParam('product_id'), getInventoryByProduct);

export default router;

