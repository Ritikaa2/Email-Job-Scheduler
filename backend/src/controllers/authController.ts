import { Request, Response, CookieOptions } from 'express';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/env';
import { query, queryOne } from '../db/mysql';
import { AuthRequest } from '../middlewares/auth';

const googleClient = new OAuth2Client(config.googleClientId);

const authCookieOptions: CookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: config.frontendUrl.startsWith('https://'),
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

const clearAuthCookieOptions: CookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: config.frontendUrl.startsWith('https://'),
  path: '/',
};

export class AuthController {
  /**
   * Register a new user with Name, Username, Email, and Password via Raw SQL
   */
  static async register(req: Request, res: Response) {
    try {
      const { name, username, email, password } = req.body;

      if (!name || !email || !password) {
        return res.status(400).json({ error: 'Name, email, and password are required' });
      }

      const trimmedEmail = email.trim().toLowerCase();
      const trimmedUsername = username ? username.trim().toLowerCase() : trimmedEmail.split('@')[0];

      // Check if email already exists
      const existingEmail = await queryOne('SELECT id FROM users WHERE email = ?', [trimmedEmail]);
      if (existingEmail) {
        return res.status(400).json({ error: 'An account with this email already exists' });
      }

      // Check if username already exists
      const existingUsername = await queryOne('SELECT id FROM users WHERE username = ?', [trimmedUsername]);
      if (existingUsername) {
        return res.status(400).json({ error: 'Username is already taken' });
      }

      const userId = uuidv4();
      const passwordHash = await bcrypt.hash(password, 10);
      const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=6366f1&color=fff`;

      await query(
        `INSERT INTO users (id, name, username, email, passwordHash, avatarUrl, createdAt) VALUES (?, ?, ?, ?, ?, ?, NOW())`,
        [userId, name, trimmedUsername, trimmedEmail, passwordHash, avatarUrl]
      );

      const token = jwt.sign({ id: userId, email: trimmedEmail }, config.jwtSecret, { expiresIn: '7d' });
      res.cookie('auth_token', token, authCookieOptions);

      return res.status(201).json({
        message: 'Account created successfully',
        token,
        user: {
          id: userId,
          name,
          username: trimmedUsername,
          email: trimmedEmail,
          avatarUrl,
        },
      });
    } catch (error: any) {
      console.error('Register error:', error);
      return res.status(500).json({ error: 'Failed to create account: ' + (error.message || 'Server error') });
    }
  }

  /**
   * Login with Username or Email & Password via Raw SQL
   */
  static async login(req: Request, res: Response) {
    try {
      const { login, password } = req.body;

      if (!login || !password) {
        return res.status(400).json({ error: 'Username/Email and password are required' });
      }

      const inputStr = login.trim().toLowerCase();

      // Find user by email or username
      const user = await queryOne<any>(
        'SELECT * FROM users WHERE email = ? OR username = ? LIMIT 1',
        [inputStr, inputStr]
      );

      if (!user || !user.passwordHash) {
        return res.status(401).json({ error: 'Invalid username/email or password' });
      }

      const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
      if (!isPasswordValid) {
        return res.status(401).json({ error: 'Invalid username/email or password' });
      }

      const token = jwt.sign({ id: user.id, email: user.email }, config.jwtSecret, { expiresIn: '7d' });
      res.cookie('auth_token', token, authCookieOptions);

      return res.json({
        message: 'Login successful',
        token,
        user: {
          id: user.id,
          name: user.name,
          username: user.username,
          email: user.email,
          avatarUrl: user.avatarUrl,
        },
      });
    } catch (error: any) {
      console.error('Login error:', error);
      return res.status(500).json({ error: 'Login failed: ' + (error.message || 'Server error') });
    }
  }

  /**
   * Update Profile Details (Name, Username, Email, Avatar, Password) via Raw SQL
   */
  static async updateProfile(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { name, username, email, avatarUrl, currentPassword, newPassword } = req.body;
      const userId = req.user.id;

      const user = await queryOne<any>('SELECT * FROM users WHERE id = ?', [userId]);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const trimmedName = name ? name.trim() : user.name;
      const trimmedEmail = email ? email.trim().toLowerCase() : user.email;
      const trimmedUsername = username ? username.trim().toLowerCase() : user.username;
      const updatedAvatar = avatarUrl !== undefined && avatarUrl !== '' ? avatarUrl : `https://ui-avatars.com/api/?name=${encodeURIComponent(trimmedName)}&background=6366f1&color=fff`;

      // Check email uniqueness if changing email
      if (trimmedEmail !== user.email) {
        const existingEmail = await queryOne('SELECT id FROM users WHERE email = ? AND id != ?', [trimmedEmail, userId]);
        if (existingEmail) {
          return res.status(400).json({ error: 'An account with this email address already exists' });
        }
      }

      // Check username uniqueness if changing username
      if (trimmedUsername && trimmedUsername !== user.username) {
        const existingUsername = await queryOne('SELECT id FROM users WHERE username = ? AND id != ?', [trimmedUsername, userId]);
        if (existingUsername) {
          return res.status(400).json({ error: 'Username is already taken' });
        }
      }

      let passwordHash = user.passwordHash;

      // If user wants to change password
      if (newPassword) {
        if (!currentPassword && user.passwordHash) {
          return res.status(400).json({ error: 'Current password is required to set a new password' });
        }

        if (user.passwordHash) {
          const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
          if (!isMatch) {
            return res.status(400).json({ error: 'Current password is incorrect' });
          }
        }

        if (newPassword.length < 6) {
          return res.status(400).json({ error: 'New password must be at least 6 characters long' });
        }

        passwordHash = await bcrypt.hash(newPassword, 10);
      }

      await query(
        `UPDATE users SET name = ?, username = ?, email = ?, avatarUrl = ?, passwordHash = ? WHERE id = ?`,
        [trimmedName, trimmedUsername, trimmedEmail, updatedAvatar, passwordHash, userId]
      );

      return res.json({
        message: 'Profile updated successfully',
        user: {
          id: userId,
          name: trimmedName,
          username: trimmedUsername,
          email: trimmedEmail,
          avatarUrl: updatedAvatar,
        },
      });
    } catch (error: any) {
      console.error('Update profile error:', error);
      return res.status(500).json({ error: 'Failed to update profile: ' + (error.message || 'Server error') });
    }
  }

  /**
   * Request Forgot Password (generates reset token via Raw SQL)
   */
  static async forgotPassword(req: Request, res: Response) {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ error: 'Email address is required' });
      }

      const trimmedEmail = email.trim().toLowerCase();
      const user = await queryOne<any>('SELECT * FROM users WHERE email = ?', [trimmedEmail]);

      if (!user) {
        return res.status(404).json({ error: 'No account found with this email address' });
      }

      const resetToken = crypto.randomBytes(3).toString('hex').toUpperCase(); // 6-digit code
      const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour expiry

      await query(
        'UPDATE users SET resetToken = ?, resetTokenExpiry = ? WHERE id = ?',
        [resetToken, resetTokenExpiry, user.id]
      );

      return res.json({
        message: 'Password reset code generated successfully',
        resetToken,
        email: user.email,
      });
    } catch (error: any) {
      console.error('Forgot password error:', error);
      return res.status(500).json({ error: 'Forgot password request failed: ' + (error.message || 'Server error') });
    }
  }

  /**
   * Reset Password with token via Raw SQL
   */
  static async resetPassword(req: Request, res: Response) {
    try {
      const { token, newPassword } = req.body;

      if (!token || !newPassword) {
        return res.status(400).json({ error: 'Reset code and new password are required' });
      }

      const user = await queryOne<any>(
        'SELECT * FROM users WHERE resetToken = ? AND resetTokenExpiry > NOW() LIMIT 1',
        [token.trim().toUpperCase()]
      );

      if (!user) {
        return res.status(400).json({ error: 'Invalid or expired password reset code' });
      }

      const passwordHash = await bcrypt.hash(newPassword, 10);

      await query(
        'UPDATE users SET passwordHash = ?, resetToken = NULL, resetTokenExpiry = NULL WHERE id = ?',
        [passwordHash, user.id]
      );

      return res.json({ message: 'Password updated successfully! You can now log in with your new password.' });
    } catch (error: any) {
      console.error('Reset password error:', error);
      return res.status(500).json({ error: 'Reset password failed: ' + (error.message || 'Server error') });
    }
  }

  /**
   * Redirect to Google OAuth URL or return Mock Login in dev mode
   */
  static async googleAuth(req: Request, res: Response) {
    if (config.googleClientId === 'mock-google-client-id' || !config.googleClientId) {
      let user = await queryOne<any>('SELECT * FROM users LIMIT 1');
      if (!user) {
        const userId = uuidv4();
        await query(
          `INSERT INTO users (id, googleId, name, username, email, avatarUrl, createdAt) VALUES (?, ?, ?, ?, ?, ?, NOW())`,
          [userId, 'mock-google-id-12345', 'Demo User', 'demouser', 'demo.user@example.com', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150']
        );
        user = { id: userId, email: 'demo.user@example.com' };
      }

      const token = jwt.sign({ id: user.id, email: user.email }, config.jwtSecret, { expiresIn: '7d' });
      res.cookie('auth_token', token, authCookieOptions);
      return res.redirect(`${config.frontendUrl}/dashboard?token=${token}`);
    }

    const authorizeUrl = googleClient.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/userinfo.profile', 'https://www.googleapis.com/auth/userinfo.email'],
      redirect_uri: config.googleCallbackUrl,
    });

    res.redirect(authorizeUrl);
  }

  /**
   * Google OAuth Callback
   */
  static async googleCallback(req: Request, res: Response) {
    const { code } = req.query;

    if (!code || typeof code !== 'string') {
      return res.status(400).redirect(`${config.frontendUrl}/login?error=InvalidAuthCode`);
    }

    try {
      const { tokens } = await googleClient.getToken({
        code,
        redirect_uri: config.googleCallbackUrl,
      });

      googleClient.setCredentials(tokens);

      const ticket = await googleClient.verifyIdToken({
        idToken: tokens.id_token!,
        audience: config.googleClientId,
      });

      const payload = ticket.getPayload();
      if (!payload || !payload.email) {
        return res.status(400).redirect(`${config.frontendUrl}/login?error=InvalidPayload`);
      }

      let user = await queryOne<any>('SELECT * FROM users WHERE googleId = ?', [payload.sub]);

      if (!user) {
        const userId = uuidv4();
        const username = payload.email.split('@')[0];
        const avatarUrl = payload.picture || null;
        await query(
          `INSERT INTO users (id, googleId, email, username, name, avatarUrl, createdAt) VALUES (?, ?, ?, ?, ?, ?, NOW())`,
          [userId, payload.sub, payload.email, username, payload.name || username, avatarUrl]
        );
        user = { id: userId, email: payload.email };
      }

      const token = jwt.sign({ id: user.id, email: user.email }, config.jwtSecret, { expiresIn: '7d' });
      res.cookie('auth_token', token, authCookieOptions);

      res.redirect(`${config.frontendUrl}/dashboard?token=${token}`);
    } catch (error: any) {
      console.error('Google Callback Error:', error);
      res.redirect(`${config.frontendUrl}/login?error=AuthFailed`);
    }
  }

  /**
   * Get current logged-in user profile
   */
  static async me(req: AuthRequest, res: Response) {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    res.json({
      id: req.user.id,
      name: req.user.name,
      username: req.user.username,
      email: req.user.email,
      avatarUrl: req.user.avatarUrl,
    });
  }

  /**
   * Logout user
   */
  static async logout(req: Request, res: Response) {
    res.clearCookie('auth_token', clearAuthCookieOptions);
    res.json({ message: 'Logged out successfully' });
  }
}

