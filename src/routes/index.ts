import express from 'express';
import authRoutes from './auth.route.js';
import userRoutes from './user.route.js';
import productRoutes from './product.route.js';
import supplierRoutes from './supplier.route.js';
import customerRoutes from './customer.route.js';
import saleRoutes from './sale.route.js';
import purchaseRoutes from './purchase.route.js';
import stockMovementRoutes from './stockMovement.route.js';
import expenseRoutes from './expense.route.js';
import reportRoutes from './report.route.js';
import inventoryRoutes from './inventory.route.js';

const router = express.Router();

// Mount route modules
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/products', productRoutes);
router.use('/suppliers', supplierRoutes);
router.use('/customers', customerRoutes);
router.use('/sales', saleRoutes);
router.use('/purchases', purchaseRoutes);
router.use('/stock-movements', stockMovementRoutes);
router.use('/expenses', expenseRoutes);
router.use('/reports', reportRoutes);
router.use('/inventory', inventoryRoutes);

export default router;

