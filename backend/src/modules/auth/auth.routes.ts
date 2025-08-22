// =====================================================
// FILE: backend/src/modules/auth/auth.routes.ts
// =====================================================
import { Router } from 'express';
import { AuthController } from './auth.controller';
import { AuthMiddleware } from './auth.middleware';
import { validateRequest, userRegistrationSchema, userLoginSchema } from '../../utils/validation';

const router = Router();
const authController = new AuthController();
const authMiddleware = new AuthMiddleware();

// Public routes
router.post('/register', validateRequest(userRegistrationSchema), authController.register);
router.post('/login', validateRequest(userLoginSchema), authController.login);

// Protected routes
router.get('/profile', authMiddleware.authenticate, authController.getProfile);
router.post('/logout', authMiddleware.authenticate, authController.logout);

export default router;

// =====================================================
// FILE: backend/src/middleware/errorHandler.ts
// =====================================================
import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export const errorHandler = (
  error: AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  logger.error('Error occurred:', {
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // Default error
  let statusCode = error.statusCode || 500;
  let message = error.message || 'Internal Server Error';

  // Database connection errors
  if (error.message.includes('ECONNREFUSED')) {
    statusCode = 503;
    message = 'Database connection failed';
  }

  // JWT errors
  if (error.message.includes('jwt')) {
    statusCode = 401;
    message = 'Invalid token';
  }

  // Validation errors
  if (error.message.includes('validation')) {
    statusCode = 400;
  }

  // Don't leak error details in production
  if (process.env.NODE_ENV === 'production' && statusCode === 500) {
    message = 'Something went wrong';
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
};
