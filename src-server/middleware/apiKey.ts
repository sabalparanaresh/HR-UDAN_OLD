import { CONFIG } from '../config.js';
import express from 'express';

export const apiKeyMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const apiKey = req.headers['x-api-header'] || req.headers['x-api-key'] || req.headers['x-app-token'] || req.query.api_key;
  
  // Log received API key to aid debugging
  if (apiKey) {
      console.log(`[apiKeyMiddleware] Received API Key: ${apiKey.toString().substring(0, 5)}...`);
  } else {
      console.log(`[apiKeyMiddleware] No API Key provided by client`);
  }

  const expectedKey = CONFIG.API_KEY;
  
  if (!apiKey || apiKey !== expectedKey) {
    if (!CONFIG.IS_PRODUCTION) {
      console.warn(`[Security] Invalid API Key attempt from ${req.ip} to ${req.path}. Expected: ${expectedKey}, Got: ${apiKey}`);
      // In dev, allow the request if the header is missing or mismatched for resilience
      return next();
    }
    return res.status(403).json({ 
      error: 'Forbidden: Invalid API Key', 
      message: `The x-api-key header is missing or incorrect.` 
    });
  }
  next();
};