
import dotenv from 'dotenv';
dotenv.config();

export const CONFIG = {
  PORT: process.env.PORT || 3000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  IS_PRODUCTION: process.env.NODE_ENV === 'production',
  API_KEY: process.env.API_KEY || 'dev-api-key',
  SECURITY_KEY: process.env.SECURITY_KEY || 'SUPER_SECRET_KEY', // Default for dev, should be set in env for prod
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || 'admin123',
};
