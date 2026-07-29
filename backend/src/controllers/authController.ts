import { Request, Response, CookieOptions } from 'express';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/env';
import { query, queryOne } from '../db/mysql';
import { AuthRequest } from '../middlewares/auth';
import { createTransporter, getOrCreateSender } from '../utils/ethereal';

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

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,30}$/;
const PASSWORD_MIN_LENGTH = 8;

function validateEmail(email: string) {
  return EMAIL_REGEX.test(email.trim().toLowerCase());
}

function getPasswordValidationError(password: string) {
  if (password.length < PASSWORD_MIN_LENGTH) return `Password must be at least ${PASSWORD_MIN_LENGTH} characters long`;
  if (!/[A-Z]/.test(password)) return 'Password must include one uppercase letter';
  if (!/[a-z]/.test(password)) return 'Password must include one lowercase letter';
  if (!/\d/.test(password)) return 'Password must include one number';
  return null;
}

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
      const trimmedName = name.trim();

      if (trimmedName.length < 2) {
        return res.status(400).json({ error: 'Full name must be at least 2 characters long' });
      }

      if (!validateEmail(trimmedEmail)) {
        return res.status(400).json({ error: 'Please enter a valid email address' });
      }

      if (!USERNAME_REGEX.test(trimmedUsername)) {
        return res.status(400).json({ error: 'Username must be 3-30 characters and use only letters, numbers, or underscore' });
      }

      const passwordError = getPasswordValidationError(password);
      if (passwordError) {
        return res.status(400).json({ error: passwordError });
      }

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
        [userId, trimmedName, trimmedUsername, trimmedEmail, passwordHash, avatarUrl]
      );

      const token = jwt.sign({ id: userId, email: trimmedEmail }, config.jwtSecret, { expiresIn: '7d' });
      res.cookie('auth_token', token, authCookieOptions);

      return res.status(201).json({
        message: 'Account created successfully',
        token,
        user: {
          id: userId,
          name: trimmedName,
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

      if (inputStr.includes('@') && !validateEmail(inputStr)) {
        return res.status(400).json({ error: 'Please enter a valid email address' });
      }

      if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters long' });
      }

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
   * Request Forgot Password OTP via Ethereal SMTP.
   */
  static async forgotPassword(req: Request, res: Response) {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ error: 'Email address is required' });
      }

      const trimmedEmail = email.trim().toLowerCase();
      if (!validateEmail(trimmedEmail)) {
        return res.status(400).json({ error: 'Please enter a valid email address.' });
      }

      let user = await queryOne<any>('SELECT * FROM users WHERE email = ?', [trimmedEmail]);

      if (!user) {
        const userId = uuidv4();
        const emailName = trimmedEmail.split('@')[0].replace(/[^a-z0-9_]/gi, '').toLowerCase() || 'user';
        let username = emailName;
        const existingUsername = await queryOne<any>('SELECT id FROM users WHERE username = ? LIMIT 1', [username]);
        if (existingUsername) {
          username = `${emailName}_${crypto.randomBytes(2).toString('hex')}`;
        }
        const displayName = emailName.charAt(0).toUpperCase() + emailName.slice(1);
        const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=6366f1&color=fff`;

        await query(
          `INSERT INTO users (id, name, username, email, avatarUrl, createdAt)
           VALUES (?, ?, ?, ?, ?, NOW())`,
          [userId, displayName, username, trimmedEmail, avatarUrl]
        );

        console.log(`[Auth] Created OTP-only account shell for ${trimmedEmail}`);
        user = await queryOne<any>('SELECT * FROM users WHERE email = ?', [trimmedEmail]);
      }

      if (!user) {
        return res.status(500).json({ error: 'Could not prepare password reset for this email.' });
      }

      const resetToken = crypto.randomInt(100000, 1000000).toString();
      const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour expiry
      const otpBoxes = resetToken
        .split('')
        .map(
          (digit) =>
            `<span style="display:inline-block;width:42px;margin:0 3px;padding:12px 0;border-radius:12px;background:#ffffff;border:1px solid #ddd6fe;color:#5b21b6;font-size:26px;font-weight:800;text-align:center;letter-spacing:0">${digit}</span>`
        )
        .join('');
      const resetLink = `${config.frontendUrl}/login`;

      await query(
        'UPDATE users SET resetToken = ?, resetTokenExpiry = ? WHERE id = ?',
        [resetToken, resetTokenExpiry, user.id]
      );

      const sender = await getOrCreateSender();
      const transporter = createTransporter(sender.smtpUser, sender.smtpPass);
      const info = await transporter.sendMail({
        from: `"ReachInbox.ai" <${sender.email}>`,
        to: trimmedEmail,
        subject: 'Your ReachInbox password reset OTP',
        text: `Your ReachInbox.ai password reset OTP is ${resetToken}. It expires in 60 minutes.`,
        html: `
          <div style="margin:0;padding:0;background:#f6f7fb;font-family:Inter,Arial,sans-serif;color:#111827">
            <div style="max-width:560px;margin:0 auto;padding:32px 16px">
              <div style="overflow:hidden;border-radius:22px;background:#ffffff;border:1px solid #e5e7eb;box-shadow:0 18px 45px rgba(79,70,229,0.14)">
                <div style="background:linear-gradient(135deg,#6d28d9,#2563eb 58%,#10b981);padding:28px 28px 34px;color:#ffffff">
                  <div style="display:inline-block;border-radius:12px;background:rgba(255,255,255,0.18);padding:10px 12px;font-weight:800">ReachInbox.ai</div>
                  <h1 style="margin:28px 0 8px;font-size:28px;line-height:1.2;font-weight:800">Password reset OTP</h1>
                  <p style="margin:0;font-size:15px;line-height:1.6;color:#eef2ff">Use this secure code to set a new password for your account.</p>
                </div>
                <div style="padding:30px 28px">
                  <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#334155">Enter this 6-digit OTP in the password reset screen:</p>
                  <div style="margin:0 0 24px;padding:18px;border-radius:18px;background:#f5f3ff;text-align:center;white-space:nowrap">
                    ${otpBoxes}
                  </div>
                  <a href="${resetLink}" style="display:block;margin:0 0 22px;padding:14px 18px;border-radius:12px;background:#4f46e5;color:#ffffff;text-align:center;text-decoration:none;font-size:15px;font-weight:800">Open reset screen</a>
                  <div style="border-radius:16px;background:#ecfdf5;border:1px solid #bbf7d0;padding:14px 16px">
                    <p style="margin:0;color:#065f46;font-size:13px;line-height:1.6"><strong>Expires in 60 minutes.</strong> If you did not request this, ignore this email and your password will stay unchanged.</p>
                  </div>
                </div>
                <div style="padding:18px 28px;background:#f8fafc;border-top:1px solid #e5e7eb">
                  <p style="margin:0;color:#64748b;font-size:12px;line-height:1.5">For your safety, never share this OTP with anyone.</p>
                </div>
              </div>
            </div>
          </div>
        `,
      });
      const previewUrl = nodemailer.getTestMessageUrl(info);

      return res.json({
        message: 'Password reset OTP has been sent to your email.',
        email: user.email,
        previewUrl: previewUrl ? String(previewUrl) : null,
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

      if (!/^\d{6}$/.test(token.trim())) {
        return res.status(400).json({ error: 'OTP must be exactly 6 digits' });
      }

      const passwordError = getPasswordValidationError(newPassword);
      if (passwordError) {
        return res.status(400).json({ error: passwordError });
      }

      const user = await queryOne<any>(
        'SELECT * FROM users WHERE resetToken = ? AND resetTokenExpiry > NOW() LIMIT 1',
        [token.trim()]
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
   * Redirect to Google OAuth URL.
   */
  static async googleAuth(req: Request, res: Response) {
    if (!config.googleClientId || !config.googleClientSecret) {
      return res.status(503).json({
        error: 'Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in backend/.env.',
      });
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

    if (!config.googleClientId || !config.googleClientSecret) {
      return res.status(503).redirect(`${config.frontendUrl}/login?error=GoogleOAuthNotConfigured`);
    }

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

