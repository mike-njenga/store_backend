import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import config from './config/env.js';

const app = express();

// security and middleware
app.use(helmet());
// cors config
app.use(cors({
    origin: config.frontendUrl,
    credentials: true,
}));

// logging
if (config.env === 'development') { 
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
    environment: config.env,
     });
  });

  // api routes 
app.use('/api/v1', apiRoutes);

export default app;