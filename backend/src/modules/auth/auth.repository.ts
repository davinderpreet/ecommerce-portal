// =====================================================
// FILE: backend/src/modules/auth/auth.repository.ts
// =====================================================
import pool from '../../config/database';
import { User, UserCreateData } from './auth.types';
import logger from '../../utils/logger';

export class AuthRepository {
  
  async createUser(userData: UserCreateData): Promise<User> {
    const client = await pool.connect();
    try {
      const query = `
        INSERT INTO users (email, password_hash, first_name, last_name, role)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `;
      
      const values = [
        userData.email,
        userData.password, // This will be hashed in the service layer
        userData.firstName,
        userData.lastName,
        userData.role || 'user'
      ];

      const result = await client.query(query, values);
      return result.rows[0];
    } catch (error) {
      logger.error('Error creating user:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async findUserByEmail(email: string): Promise<User | null> {
    const client = await pool.connect();
    try {
      const query = 'SELECT * FROM users WHERE email = $1';
      const result = await client.query(query, [email]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error finding user by email:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async findUserById(id: string): Promise<User | null> {
    const client = await pool.connect();
    try {
      const query = 'SELECT * FROM users WHERE id = $1';
      const result = await client.query(query, [id]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error finding user by ID:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async updateLastLogin(userId: string): Promise<void> {
    const client = await pool.connect();
    try {
      const query = 'UPDATE users SET last_login = NOW() WHERE id = $1';
      await client.query(query, [userId]);
    } catch (error) {
      logger.error('Error updating last login:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async getAllUsers(): Promise<User[]> {
    const client = await pool.connect();
    try {
      const query = 'SELECT * FROM users ORDER BY created_at DESC';
      const result = await client.query(query);
      return result.rows;
    } catch (error) {
      logger.error('Error getting all users:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | null> {
    const client = await pool.connect();
    try {
      const fields = Object.keys(updates);
      const values = Object.values(updates);
      
      if (fields.length === 0) {
        return await this.findUserById(id);
      }

      const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');
      const query = `UPDATE users SET ${setClause} WHERE id = $1 RETURNING *`;
      
      const result = await client.query(query, [id, ...values]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error updating user:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async deleteUser(id: string): Promise<boolean> {
    const client = await pool.connect();
    try {
      const query = 'DELETE FROM users WHERE id = $1';
      const result = await client.query(query, [id]);
      return result.rowCount! > 0;
    } catch (error) {
      logger.error('Error deleting user:', error);
      throw error;
    } finally {
      client.release();
    }
  }
}
