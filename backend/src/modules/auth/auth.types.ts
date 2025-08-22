// =====================================================
// FILE: backend/src/modules/auth/auth.types.ts
// =====================================================
export interface User {
  id: string;
  email: string;
  password_hash: string;
  first_name: string;
  last_name: string;
  role: 'admin' | 'user';
  is_active: boolean;
  last_login?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface UserCreateData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role?: 'admin' | 'user';
}

export interface UserResponse {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'user';
  isActive: boolean;
  lastLogin?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthResponse {
  success: boolean;
  user?: UserResponse;
  token?: string;
  message?: string;
}

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
  iat?: number;  // Add optional JWT standard fields
  exp?: number;
}
