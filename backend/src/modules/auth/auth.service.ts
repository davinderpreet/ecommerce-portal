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

      // Generate token - FIXED SYNTAX
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

      // Generate token - FIXED SYNTAX
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

  // FIXED: Correct JWT signing syntax
  private generateToken(payload: JwtPayload): string {
    const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
    
    return jwt.sign(
      payload,           // First parameter: payload
      this.jwtSecret,    // Second parameter: secret
      { expiresIn }      // Third parameter: options object
    );
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
// Alternative Minimal Version (if above still has issues)
// =====================================================

// If you're still having issues, use this ultra-simple version:

export class SimpleAuthService {
  private jwtSecret: string;

  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || 'fallback-secret';
  }

  // Simple token generation without complex types
  generateSimpleToken(userId: string, email: string, role: string): string {
    const payload = { userId, email, role };
    const options = { expiresIn: '7d' };
    
    return jwt.sign(payload, this.jwtSecret, options);
  }

  // Simple token verification
  verifySimpleToken(token: string): any {
    try {
      return jwt.verify(token, this.jwtSecret);
    } catch (error) {
      return null;
    }
  }
}
