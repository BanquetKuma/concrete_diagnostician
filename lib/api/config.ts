// API configuration for Cloudflare Workers

export interface ApiConfig {
  baseUrl: string;
  timeout: number;
}

// Production API URL (Cloudflare Workers)
const PRODUCTION_API_URL = 'https://concrete-diagnostician-api.banquet-kuma.workers.dev';
const DEVELOPMENT_API_URL = 'http://localhost:8787';

// Environment-based configuration
export const getApiConfig = (): ApiConfig => {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const useLocalApi = process.env.USE_LOCAL_API === 'true';

  return {
    baseUrl: isDevelopment && useLocalApi ? DEVELOPMENT_API_URL : PRODUCTION_API_URL,
    timeout: 30000, // 30 seconds
  };
};

// Legacy Azure config getter (for backward compatibility during migration)
export const getAzureConfig = () => {
  const config = getApiConfig();
  return {
    functions: {
      baseUrl: config.baseUrl,
      key: undefined,
    },
  };
};

// API endpoints for Cloudflare Workers
export const API_ENDPOINTS = {
  health: '/api/health',
  users: {
    register: '/api/users/register',
    get: (userId: string) => `/api/users/${userId}`,
    delete: (userId: string) => `/api/users/${userId}`,
  },
  questions: {
    years: '/api/questions/years',
    categories: '/api/questions/categories',
    list: (year: number) => `/api/questions/${year}`,
    listByCategory: (category: string) => `/api/questions/category/${category}`,
    detail: (year: number, questionId: string) => `/api/questions/${year}/${questionId}`,
    detailByCategory: (category: string, questionId: string) => `/api/questions/category/${category}/${questionId}`,
  },
  answers: {
    save: '/api/answers',
    userAnswers: (userId: string) => `/api/answers/user/${userId}`,
    clearByCategory: (userId: string, category: string) => `/api/answers/user/${userId}/category/${category}`,
    clearAll: (userId: string) => `/api/answers/user/${userId}`,
  },
  progress: {
    get: (userId: string) => `/api/progress/${userId}`,
    byYear: (userId: string, year: number) => `/api/progress/${userId}/year/${year}`,
    byCategory: (userId: string, category: string) => `/api/progress/${userId}/category/${category}`,
  },
} as const;
