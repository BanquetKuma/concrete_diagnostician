// Web用のexpo-secure-storeモック
// Clerk SDKがexpo-secure-storeを内部で使用するため、
// Webでは空の実装を提供する

export async function getItemAsync(key: string): Promise<string | null> {
  if (typeof window !== 'undefined' && window.localStorage) {
    return localStorage.getItem(key);
  }
  return null;
}

export async function setItemAsync(key: string, value: string): Promise<void> {
  if (typeof window !== 'undefined' && window.localStorage) {
    localStorage.setItem(key, value);
  }
}

export async function deleteItemAsync(key: string): Promise<void> {
  if (typeof window !== 'undefined' && window.localStorage) {
    localStorage.removeItem(key);
  }
}

// Clerk SDKが使用する可能性のある他の関数もモック
export async function getValueWithKeyAsync(key: string): Promise<string | null> {
  return getItemAsync(key);
}

export async function setValueWithKeyAsync(key: string, value: string): Promise<void> {
  return setItemAsync(key, value);
}

export async function deleteValueWithKeyAsync(key: string): Promise<void> {
  return deleteItemAsync(key);
}

export default {
  getItemAsync,
  setItemAsync,
  deleteItemAsync,
  getValueWithKeyAsync,
  setValueWithKeyAsync,
  deleteValueWithKeyAsync,
};
