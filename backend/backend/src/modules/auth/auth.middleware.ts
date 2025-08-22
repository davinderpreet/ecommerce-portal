import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email: string;
        role: string;
      };
    }
  }
}

export class AuthMiddleware {
  private authService: AuthService;

  constructor() {
    this.authService = new AuthService();
  }

  authenticate = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          success: false,
          message: 'Access token is required'
        });
      }

      const token = authHeader.substring(7); // Remove 'Bearer ' prefix
      const decoded = this.authService.verifyToken(token);

      if (!decoded) {
        return res.status(401).json({
          success: false,
          message: 'Invalid or expired token'
        });
      }

      // Verify user still exists and is active
      const user = await this.authService.getUserById(decoded.userId);
      if (!user || !user.isActive) {
        return res.status(401).json({
          success: false,
          message: 'User account is inactive'
        });
      }

      // Add user info to request
      req.user = decoded;
      next();
    } catch (error) {
      console.error('Authentication middleware error:', error);
      return res.status(500).json({
        success: false,
        message: 'Authentication failed'
      });
    }
  };

  authorize = (roles: string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      if (!roles.includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions'
        });
      }

      next();
    };
  };
}
