// Environment configuration

export const isDevelopment = process.env.NODE_ENV === 'development';
export const isProduction = process.env.NODE_ENV === 'production';

// Feature flags
export const FEATURE_FLAGS = {
  USE_MOCK_API: isDevelopment && !process.env.USE_REAL_API,
  VERBOSE_LOGGING: isDevelopment && process.env.VERBOSE_LOGGING === 'true',
  DISABLE_API_CALLS: false, // API calls enabled - using Cloudflare Workers
} as const;

// API configuration
export const API_CONFIG = {
  TIMEOUT: 30000, // 30 seconds
  RETRY_COUNT: 3,
  RETRY_DELAY: 1000, // 1 second
} as const;