import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import config from './config/env.js';
//rotes
import authRoutes from './routes/auth.route.js';
import userRoutes from './routes/user.route.js';
import productRoutes from './routes/product.route.js';
import supplierRoutes from './routes/supplier.route.js';
import customerRoutes from './routes/customer.route.js';
import saleRoutes from './routes/sale.route.js';
import purchaseRoutes from './routes/purchase.route.js';
import stockMovementRoutes from './routes/stockMovement.route.js';
import expenseRoutes from './routes/expense.route.js';
import reportRoutes from './routes/report.route.js';
import inventoryRoutes from './routes/inventory.route.js';
import paymentRoutes from './routes/payment.route.js';

const app = express();

// security and middleware
app.use(helmet());
// cors config
app.use(cors({
    origin: config.frontendUrl,
    credentials: true,
}));
// cookie parser - must be before routes
app.use(cookieParser());

// logging
if (config.nodeEnv === 'development') { 
    app.use(morgan('dev'));
} else {
    app.use(morgan('combined'));
}

// body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// rate limiting
if (config.rateLimit.enable) {
    const limiter = rateLimit({
      windowMs: config.rateLimit.windowMs,
      max: config.rateLimit.max,
      message: config.rateLimit.message
    });
    app.use('/api/', limiter);
  }

  // body parser
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));


  // health check
  app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'OK',
    message: 'server is running',
    environment: config.nodeEnv,
     });
  });


// Mount route modules
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/sales', saleRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/stock-movements', stockMovementRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/payments', paymentRoutes);

// 404 handler
app.use((req, res, next) => {
    res.status(404).json({ status: 'error', message: 'not found' });
});

// error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error(err.stack);
    res.status(500).json({ 
      error: 'Internal server error',
      message: config.nodeEnv === 'development' ? err.message : 'Something went wrong'
    });
  });


  // start the server
  app.listen(config.port, () => {
    console.log(`Server is running on port ${config.port}`);
  });

export default app;