/**
 * User Service
 *
 * Purpose: Manage user initialization and session
 * Features:
 * - Device-based user management
 * - User session storage using Expo SecureStore
 * - User creation and retrieval from backend
 */

import * as SecureStore from 'expo-secure-store';
import { apiClient, User } from '@/lib/api/client';

const USER_ID_KEY = 'concrete_diagnostician_user_id';
const DEVICE_ID_KEY = 'concrete_diagnostician_device_id';

/**
 * Generate a unique device ID
 */
function generateDeviceId(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 15);
  return `device_${timestamp}_${randomPart}`;
}

// Extended User type for local use
export interface AppUser extends User {
  lastAccessedAt: Date;
}

/**
 * User service for managing user session and data
 */
export const userService = {
  /**
   * Initialize user - get existing or create new
   */
  async initializeUser(): Promise<AppUser> {
    try {
      // Get or generate device ID
      let deviceId = await SecureStore.getItemAsync(DEVICE_ID_KEY);
      if (!deviceId) {
        deviceId = generateDeviceId();
        await SecureStore.setItemAsync(DEVICE_ID_KEY, deviceId);
      }

      // Register/get user with device ID
      const response = await apiClient.registerUser(deviceId);
      const user = response.user;

      // Store user ID in secure storage
      await SecureStore.setItemAsync(USER_ID_KEY, user.id);

      return {
        id: user.id,
        deviceId: user.deviceId,
        createdAt: user.createdAt,
        lastAccessedAt: new Date(),
      };
    } catch (error) {
      console.error('Failed to initialize user:', error);

      // Fallback: create local-only user for offline capability
      const fallbackDeviceId = generateDeviceId();
      const fallbackId = `local_${fallbackDeviceId}`;
      await SecureStore.setItemAsync(USER_ID_KEY, fallbackId);
      await SecureStore.setItemAsync(DEVICE_ID_KEY, fallbackDeviceId);

      return {
        id: fallbackId,
        deviceId: fallbackDeviceId,
        createdAt: new Date().toISOString(),
        lastAccessedAt: new Date(),
      };
    }
  },

  /**
   * Clear user session (logout)
   */
  async clearUserSession(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(USER_ID_KEY);
    } catch (error) {
      console.error('Failed to clear user session:', error);
      throw error;
    }
  },

  /**
   * Get stored user ID
   */
  async getStoredUserId(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(USER_ID_KEY);
    } catch (error) {
      console.error('Failed to get stored user ID:', error);
      return null;
    }
  },
};
