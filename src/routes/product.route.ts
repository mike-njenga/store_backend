import express from 'express';
import {
    createProduct,
    getProducts,
    getProductById,
    updateProduct,
    updateProductPrice,
    updateProductStatus,
} from '../controllers/product.controller.js';
import {
    validateCreateProduct,
    validateUpdateProduct,
    validateUpdateProductPrice,
    validateUpdateProductStatus,
    validateUUIDParam,
    validatePagination,
} from '../middleware/validation.js';
import { authenticateUser } from '../middleware/auth.js';
import authorizeRole from '../middleware/role.js';

const router = express.Router();

// All product routes require authentication
router.use(authenticateUser);

// Public endpoints (authenticated users can view)
router.get('/', validatePagination, getProducts);
router.get('/:id', validateUUIDParam('id'), getProductById);

// Protected endpoints (only owner/manager can create/edit)
router.post('/', authorizeRole('owner', 'manager'), validateCreateProduct, createProduct);
router.put('/:id', authorizeRole('owner', 'manager'), validateUUIDParam('id'), validateUpdateProduct, updateProduct);
router.patch('/:id/price', authorizeRole('owner', 'manager'), validateUUIDParam('id'), validateUpdateProductPrice, updateProductPrice);
router.patch('/:id/status', authorizeRole('owner', 'manager'), validateUUIDParam('id'), validateUpdateProductStatus, updateProductStatus);

export default router;

