// User management hook with secure storage
// Uses expo-secure-store for iOS Keychain / Android Keystore

import * as SecureStore from 'expo-secure-store';
import * as Device from 'expo-device';
import { apiClient, User, ApiError } from './client';

const USER_ID_KEY = 'concrete_diagnostician_user_id';
const DEVICE_ID_KEY = 'concrete_diagnostician_device_id';

/**
 * Get or generate a unique device ID
 * Stores in SecureStore for persistence across app reinstalls
 */
async function getDeviceId(): Promise<string> {
  // Try to get cached device ID first
  const cachedDeviceId = await SecureStore.getItemAsync(DEVICE_ID_KEY);
  if (cachedDeviceId) {
    return cachedDeviceId;
  }

  // Generate new device ID using device info
  const deviceName = Device.deviceName || 'unknown';
  const modelName = Device.modelName || 'unknown';
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);

  const newDeviceId = `${deviceName}-${modelName}-${timestamp}-${random}`;

  // Cache for future use
  await SecureStore.setItemAsync(DEVICE_ID_KEY, newDeviceId);

  return newDeviceId;
}

/**
 * Get the current user ID from secure storage
 * Returns null if user hasn't been registered yet
 */
export async function getCurrentUserId(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(USER_ID_KEY);
  } catch (error) {
    console.error('Failed to get user ID from secure storage:', error);
    return null;
  }
}

/**
 * Get or create a user
 * - If user ID is cached, fetches user from API
 * - If no cached ID, registers new user with device ID
 * - Caches user ID in secure storage for future use
 */
export async function getOrCreateUser(): Promise<User | null> {
  try {
    // Check for cached user ID
    const cachedUserId = await getCurrentUserId();

    if (cachedUserId) {
      // Try to fetch existing user
      try {
        const response = await apiClient.getUser(cachedUserId);
        return response.user;
      } catch (error) {
        // If user not found (404), clear cache and re-register
        if (error instanceof ApiError && error.statusCode === 404) {
          await SecureStore.deleteItemAsync(USER_ID_KEY);
          console.log('Cached user not found, re-registering...');
        } else {
          throw error;
        }
      }
    }

    // Register new user with device ID
    const deviceId = await getDeviceId();
    const response = await apiClient.registerUser(deviceId);

    // Cache the user ID
    await SecureStore.setItemAsync(USER_ID_KEY, response.user.id);

    if (response.isNew) {
      console.log('New user registered:', response.user.id);
    } else {
      console.log('Existing user retrieved:', response.user.id);
    }

    return response.user;
  } catch (error) {
    console.error('Failed to get or create user:', error);
    return null;
  }
}

/**
 * Clear user data from secure storage
 * Useful for logout or account reset functionality
 */
export async function clearUserData(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(USER_ID_KEY);
    // Note: We keep DEVICE_ID_KEY for device tracking
    console.log('User data cleared');
  } catch (error) {
    console.error('Failed to clear user data:', error);
  }
}

/**
 * Check if user is registered (has cached user ID)
 */
export async function isUserRegistered(): Promise<boolean> {
  const userId = await getCurrentUserId();
  return userId !== null;
}
