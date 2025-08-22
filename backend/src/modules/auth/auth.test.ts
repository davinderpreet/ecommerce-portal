// =====================================================
// FILE: backend/src/modules/auth/auth.test.ts
// =====================================================
import { AuthService } from './auth.service';
import { UserCreateData, LoginCredentials } from './auth.types';

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(() => {
    authService = new AuthService();
  });

  describe('User Registration', () => {
    it('should register a new user successfully', async () => {
      const userData: UserCreateData = {
        email: 'test@example.com',
        password: 'password123',
        firstName: 'Test',
        lastName: 'User'
      };

      const result = await authService.registerUser(userData);
      
      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.token).toBeDefined();
      expect(result.user?.email).toBe(userData.email);
    });

    it('should not register user with existing email', async () => {
      const userData: UserCreateData = {
        email: 'existing@example.com',
        password: 'password123',
        firstName: 'Test',
        lastName: 'User'
      };

      // Register first user
      await authService.registerUser(userData);
      
      // Try to register again with same email
      const result = await authService.registerUser(userData);
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('already exists');
    });
  });

  describe('User Login', () => {
    it('should login with valid credentials', async () => {
      const userData: UserCreateData = {
        email: 'login@example.com',
        password: 'password123',
        firstName: 'Login',
        lastName: 'User'
      };

      // Register user first
      await authService.registerUser(userData);

      // Login
      const loginData: LoginCredentials = {
        email: userData.email,
        password: userData.password
      };

      const result = await authService.loginUser(loginData);
      
      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.token).toBeDefined();
    });

    it('should not login with invalid credentials', async () => {
      const loginData: LoginCredentials = {
        email: 'nonexistent@example.com',
        password: 'wrongpassword'
      };

      const result = await authService.loginUser(loginData);
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('Invalid');
    });
  });
});
