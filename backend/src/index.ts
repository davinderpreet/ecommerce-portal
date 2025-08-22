import express from 'express';
import helmet from 'helmet';
import dotenv from 'dotenv';
import corsMiddleware from './middleware/cors';
import { errorHandler } from './middleware/errorHandler';
import { apiLimiter, authLimiter } from './middleware/rateLimiter';
import apiRoutes from './routes';
import logger from './utils/logger';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS
app.use(corsMiddleware);

// Rate limiting
app.use('/api', apiLimiter);
app.use('/api/auth', authLimiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  next();
});

// API routes
app.use('/api', apiRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'E-commerce Portal API',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString()
  });
});

// Error handling
app.use(errorHandler);

// Start server
const server = app.listen(PORT, () => {
  logger.info(`🚀 Server running on port ${PORT}`);
  logger.info(`📊 Health check: http://localhost:${PORT}/api/health`);
  logger.info(`🔐 Auth endpoints: http://localhost:${PORT}/api/auth`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
  });
});

export default app;
