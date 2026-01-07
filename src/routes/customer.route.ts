import express from 'express';
import {
    createCustomer,
    getCustomers,
    getCustomerById,
    updateCustomer,
    updateCustomerStatus,
    deleteCustomer,
} from '../controllers/customer.controller.js';
import {
    validateCreateCustomer,
    validateUpdateCustomer,
    validateUpdateCustomerStatus,
    validateUUIDParam,
    validatePagination,
} from '../middleware/validation.js';
import { authenticateUser } from '../middleware/auth.js';
import authorizeRole from '../middleware/role.js';

const router = express.Router();

// All customer routes require authentication
router.use(authenticateUser);

// Public endpoints (authenticated users can view)
router.get('/', validatePagination, getCustomers);
router.get('/:id', validateUUIDParam('id'), getCustomerById);

// Protected endpoints (only owner/manager can create/edit/delete)
router.post('/', authorizeRole('owner', 'manager'), validateCreateCustomer, createCustomer);
router.put('/:id', authorizeRole('owner', 'manager'), validateUUIDParam('id'), validateUpdateCustomer, updateCustomer);
router.patch('/:id/status', authorizeRole('owner', 'manager'), validateUUIDParam('id'), validateUpdateCustomerStatus, updateCustomerStatus);
router.delete('/:id', authorizeRole('owner', 'manager'), validateUUIDParam('id'), deleteCustomer);

export default router;

