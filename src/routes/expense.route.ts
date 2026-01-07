import express from 'express';
import {
    createExpense,
    getExpenses,
    getExpenseById,
    updateExpense,
    deleteExpense,
} from '../controllers/expense.controller.js';
import {
    validateCreateExpense,
    validateUpdateExpense,
    validateUUIDParam,
    validatePagination,
} from '../middleware/validation.js';
import { authenticateUser } from '../middleware/auth.js';
import authorizeRole from '../middleware/role.js';

const router = express.Router();

// All expense routes require authentication
router.use(authenticateUser);

// Public endpoints (authenticated users can view)
router.get('/', validatePagination, getExpenses);
router.get('/:id', validateUUIDParam('id'), getExpenseById);

// Protected endpoints (only owner/manager can create/edit/delete)
router.post('/', authorizeRole('owner', 'manager'), validateCreateExpense, createExpense);
router.put('/:id', authorizeRole('owner', 'manager'), validateUUIDParam('id'), validateUpdateExpense, updateExpense);
router.delete('/:id', authorizeRole('owner', 'manager'), validateUUIDParam('id'), deleteExpense);

export default router;

