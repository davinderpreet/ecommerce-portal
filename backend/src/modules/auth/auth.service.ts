// =====================================================
// FILE: backend/src/modules/auth/auth.service.ts
// =====================================================
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { AuthRepository } from './auth.repository';
import { 
  UserCreateData, 
  UserResponse, 
  LoginCredentials, 
  AuthResponse,
  JwtPayload 
} from './auth.types';
import logger from '../../utils/logger';

export class AuthService {
  private authRepository: AuthRepository;
  private jwtSecret: string;

  constructor() {
    this.authRepository = new AuthRepository();
    this.jwtSecret = process.env.JWT_SECRET || 'fallback-secret-change-this';
  }

  async registerUser(userData: UserCreateData): Promise<AuthResponse> {
    try {
      // Check if user already exists
      const existingUser = await this.authRepository.findUserByEmail(userData.email);
      if (existingUser) {
        return {
          success: false,
          message: 'User with this email already exists'
        };
      }

      // Hash password
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(userData.password, saltRounds);

      // Create user
      const user = await this.authRepository.createUser({
        ...userData,
        password: hashedPassword
      });

      // Generate token
      const token = this.generateToken({
        userId: user.id,
        email: user.email,
        role: user.role
      });

      return {
        success: true,
        user: this.formatUserResponse(user),
        token,
        message: 'User registered successfully'
      };
    } catch (error) {
      logger.error('Registration error:', error);
      return {
        success: false,
        message: 'Registration failed'
      };
    }
  }

  async loginUser(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      // Find user by email
      const user = await this.authRepository.findUserByEmail(credentials.email);
      if (!user) {
        return {
          success: false,
          message: 'Invalid email or password'
        };
      }

      // Check if user is active
      if (!user.is_active) {
        return {
          success: false,
          message: 'Account is deactivated'
        };
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(credentials.password, user.password_hash);
      if (!isPasswordValid) {
        return {
          success: false,
          message: 'Invalid email or password'
        };
      }

      // Update last login
      await this.authRepository.updateLastLogin(user.id);

      // Generate token
      const token = this.generateToken({
        userId: user.id,
        email: user.email,
        role: user.role
      });

      return {
        success: true,
        user: this.formatUserResponse(user),
        token,
        message: 'Login successful'
      };
    } catch (error) {
      logger.error('Login error:', error);
      return {
        success: false,
        message: 'Login failed'
      };
    }
  }

  async getUserById(id: string): Promise<UserResponse | null> {
    try {
      const user = await this.authRepository.findUserById(id);
      if (!user) return null;
      return this.formatUserResponse(user);
    } catch (error) {
      logger.error('Get user error:', error);
      return null;
    }
  }

  verifyToken(token: string): JwtPayload | null {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as JwtPayload;
      return decoded;
    } catch (error) {
      logger.error('Token verification error:', error);
      return null;
    }
  }

  private generateToken(payload: JwtPayload): string {
    return jwt.sign(payload, this.jwtSecret, {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d'
    });
  }

  private formatUserResponse(user: any): UserResponse {
    return {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role,
      isActive: user.is_active,
      lastLogin: user.last_login?.toISOString(),
      createdAt: user.created_at.toISOString(),
      updatedAt: user.updated_at.toISOString()
    };
  }
}

// =====================================================
// FILE: backend/src/modules/auth/auth.middleware.ts
// =====================================================
import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service';
import logger from '../../utils/logger';

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
      logger.error('Authentication middleware error:', error);
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
