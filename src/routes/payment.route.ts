import { Router } from 'express';
import {
    recordPayment,
    getSalePayments,
    getCustomerPayments,
    getCustomerOutstanding,
    deletePayment,
} from '../controllers/payment.controller.js';
import { authenticateUser } from '../middleware/auth.js';
import authorizeRole from '../middleware/role.js';
import {
    validateCreatePayment,
    validateUUIDParam,
    validatePagination,
    validatePaymentDateRange,
} from '../middleware/validation.js';

const router = Router();

// All payment routes require authentication
router.use(authenticateUser);

// Record a payment for a sale
router.post(
    '/',
    authorizeRole('owner', 'manager', 'cashier'),
    validateCreatePayment,
    recordPayment
);

// Get payment history for a specific sale
router.get(
    '/sale/:saleId',
    validateUUIDParam('saleId'),
    getSalePayments
);

// Get payment history for a specific customer
router.get(
    '/customer/:customerId',
    validateUUIDParam('customerId'),
    validatePagination,
    validatePaymentDateRange,
    getCustomerPayments
);

// Get customer outstanding balance and unpaid sales
router.get(
    '/customer/:customerId/outstanding',
    validateUUIDParam('customerId'),
    getCustomerOutstanding
);

// Delete a payment (only managers/owners)
router.delete(
    '/:paymentId',
    authorizeRole('owner', 'manager'),
    validateUUIDParam('paymentId'),
    deletePayment
);

export default router;

