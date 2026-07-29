import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { queryOne } from '../db/mysql';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    username?: string | null;
    email: string;
    name: string;
    avatarUrl?: string | null;
  };
}

export async function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    let token = req.cookies?.auth_token;

    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized. Please log in.' });
    }

    const decoded = jwt.verify(token, config.jwtSecret) as { id: string; email: string };
    const user = await queryOne<any>('SELECT * FROM users WHERE id = ?', [decoded.id]);

    if (!user) {
      return res.status(401).json({ error: 'User not found.' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}
