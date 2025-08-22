import { Request, Response, NextFunction } from 'express';

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
  console.error('Error occurred:', {
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method
  });

  let statusCode = error.statusCode || 500;
  let message = error.message || 'Internal Server Error';

  if (error.message.includes('ECONNREFUSED')) {
    statusCode = 503;
    message = 'Database connection failed';
  }

  if (error.message.includes('jwt')) {
    statusCode = 401;
    message = 'Invalid token';
  }

  if (process.env.NODE_ENV === 'production' && statusCode === 500) {
    message = 'Something went wrong';
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
};
