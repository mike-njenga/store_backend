import express from 'express';
import authRoutes from './auth.route.js';
import userRoutes from './user.route.js';
import productRoutes from './product.route.js';
import supplierRoutes from './supplier.route.js';
import customerRoutes from './customer.route.js';
import saleRoutes from './sale.route.js';
import purchaseRoutes from './purchase.route.js';
import stockMovementRoutes from './stockMovement.route.js';

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

export default router;

