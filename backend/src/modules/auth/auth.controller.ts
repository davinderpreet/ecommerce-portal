// =====================================================
// FILE: backend/src/modules/auth/auth.controller.ts
// =====================================================
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { validateRequest, userRegistrationSchema, userLoginSchema } from '../../utils/validation';
import logger from '../../utils/logger';

export class AuthController {
  private authService: AuthService;

  constructor() {
    this.authService = new AuthService();
  }

  register = async (req: Request, res: Response) => {
    try {
      const result = await this.authService.registerUser(req.body);
      
      const statusCode = result.success ? 201 : 400;
      res.status(statusCode).json(result);
      
      if (result.success) {
        logger.info(`User registered: ${req.body.email}`);
      } else {
        logger.warn(`Registration failed for: ${req.body.email}`);
      }
    } catch (error) {
      logger.error('Registration controller error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };

  login = async (req: Request, res: Response) => {
    try {
      const result = await this.authService.loginUser(req.body);
      
      const statusCode = result.success ? 200 : 401;
      res.status(statusCode).json(result);
      
      if (result.success) {
        logger.info(`User logged in: ${req.body.email}`);
      } else {
        logger.warn(`Login failed for: ${req.body.email}`);
      }
    } catch (error) {
      logger.error('Login controller error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };

  getProfile = async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      const user = await this.authService.getUserById(req.user.userId);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      res.json({
        success: true,
        data: user
      });
    } catch (error) {
      logger.error('Get profile error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };

  logout = async (req: Request, res: Response) => {
    try {
      // In a real application, you might want to blacklist the token
      // For now, we'll just return a success response
      res.json({
        success: true,
        message: 'Logged out successfully'
      });
    } catch (error) {
      logger.error('Logout error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };
}
