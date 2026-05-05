export interface User {
  _id: string;
  name: string;
  email: string;
  authProvider: 'local' | 'google';
  avatar?: string;
  isAccountVerified?: boolean;
}

export interface AuthResponse {
  token: string;
  user: User;
}

