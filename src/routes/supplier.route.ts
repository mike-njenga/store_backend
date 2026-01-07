import express from 'express';
import {
    createSupplier,
    getSuppliers,
    getSupplierById,
    updateSupplier,
    updateSupplierStatus,
    deleteSupplier,
} from '../controllers/supplier.controller.js';
import {
    validateCreateSupplier,
    validateUpdateSupplier,
    validateUpdateSupplierStatus,
    validateUUIDParam,
    validatePagination,
} from '../middleware/validation.js';
import { authenticateUser } from '../middleware/auth.js';
import authorizeRole from '../middleware/role.js';

const router = express.Router();

// All supplier routes require authentication
router.use(authenticateUser);

// Public endpoints (authenticated users can view)
router.get('/', validatePagination, getSuppliers);
router.get('/:id', validateUUIDParam('id'), getSupplierById);

// Protected endpoints (only owner/manager can create/edit/delete)
router.post('/', authorizeRole('owner', 'manager'), validateCreateSupplier, createSupplier);
router.put('/:id', authorizeRole('owner', 'manager'), validateUUIDParam('id'), validateUpdateSupplier, updateSupplier);
router.patch('/:id/status', authorizeRole('owner', 'manager'), validateUUIDParam('id'), validateUpdateSupplierStatus, updateSupplierStatus);
router.delete('/:id', authorizeRole('owner', 'manager'), validateUUIDParam('id'), deleteSupplier);

export default router;

