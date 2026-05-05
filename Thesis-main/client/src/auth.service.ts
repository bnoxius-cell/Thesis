import { Observable, from, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import axios from 'axios';
import { User, AuthResponse } from './user.interface';

const API_BASE = 'http://localhost:5000/api/auth';

class AxiosInstance {
  private axios = axios.create({
    baseURL: API_BASE,
    headers: { 'Content-Type': 'application/json' },
  });

  constructor() {
    this.axios.interceptors.request.use((config) => {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });
  }

  post<T>(url: string, data: any): Observable<T> {
    return from(this.axios.post(url, data)).pipe(
      map((response) => response.data),
      catchError((error) => throwError(() => new Error(error.response?.data?.message || 'API Error')))
    );
  }
}

export const apiClient = new AxiosInstance();

export class AuthService {
  login(emailOrUsername: string, password: string): Observable<AuthResponse> {
    return apiClient.post<AuthResponse>('/login', { email: emailOrUsername, password });
  }

  register(name: string, email: string, password: string): Observable<AuthResponse> {
    return apiClient.post<AuthResponse>('/register', { name, email, password });
  }

  getProfile(): Observable<User> {
    return apiClient.post<User>('/profile', {});
  }

  logout(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }

  getToken(): string | null {
    return localStorage.getItem('token');
  }

  setAuthData(token: string, user: User): void {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }
}

export const authService = new AuthService();
