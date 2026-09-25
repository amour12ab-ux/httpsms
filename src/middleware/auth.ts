import { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';

dotenv.config();

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || apiKey !== process.env.API_KEY) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or missing API Key' });
  }
  next();
};
