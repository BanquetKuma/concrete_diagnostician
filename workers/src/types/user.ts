export interface User {
  id: string;
  deviceId: string;
  createdAt: string;
}

export interface UserCreateRequest {
  deviceId: string;
}
