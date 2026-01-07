import express from 'express';
import {
    getDashboard,
    getSalesReport,
    getInventoryReport,
    getFinancialReport,
    getProductPerformanceReport,
} from '../controllers/report.controller.js';
import { authenticateUser } from '../middleware/auth.js';

const router = express.Router();

// All report routes require authentication
router.use(authenticateUser);

// Dashboard
router.get('/dashboard', getDashboard);

// Reports
router.get('/sales', getSalesReport);
router.get('/inventory', getInventoryReport);
router.get('/financial', getFinancialReport);
router.get('/products', getProductPerformanceReport);

export default router;

