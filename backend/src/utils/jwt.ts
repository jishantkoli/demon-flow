import jwt from 'jsonwebtoken';
import { Response } from 'express';

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';
const COOKIE_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 days

export const generateTokens = (user: any) => {
  const accessToken = jwt.sign(
    { id: user._id, role: user.role, schoolCode: user.profile.schoolCode },
    process.env.JWT_ACCESS_SECRET!,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );

  const refreshToken = jwt.sign(
    { id: user._id },
    process.env.JWT_REFRESH_SECRET!,
    { expiresIn: REFRESH_TOKEN_EXPIRY }
  );

  return { accessToken, refreshToken };
};

export const setRefreshTokenCookie = (res: Response, token: string) => {
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: COOKIE_EXPIRY,
    signed: true
  });
};
