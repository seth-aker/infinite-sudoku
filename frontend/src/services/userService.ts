import { config } from "@/config";
import { safeFetch, type ServiceResult } from "./baseService";
const BASE_URL: string = config.API_BASE_URL;
export interface UserDto {
  id: string;
  username: string;
  email: string;
  imageUrl?: string;
  currentPuzzleId?: string;
  role: 'user' | 'admin'
}

export async function login(
  email: string,
  password: string,
): Promise<ServiceResult<{ user: UserDto }>> {
  return await safeFetch(`${BASE_URL}/auth/web/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password }),
  });
}
export async function logout(): Promise<ServiceResult<void>> {
  return await safeFetch(`${BASE_URL}/auth/web/logout`, {
    method: "POST",
    credentials: "include",
  });
}
export async function getSession(): Promise<
  ServiceResult<{ user: UserDto }>
> {
  return await safeFetch(`${BASE_URL}/users/me`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
  });
}
export async function register(
  email: string,
  password: string,
  username: string,
  tosAcknowledged: boolean
): Promise<ServiceResult<{ user: UserDto }>> {
  return await safeFetch(`${BASE_URL}/auth/web/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify({
      email,
      password,
      username,
      tosAcknowledged,
    }),
  });
}

export async function validateEmail(token: string): Promise<ServiceResult<void>> {
  return await safeFetch(`${BASE_URL}/auth/validateEmail?token=${token}`, {
    method: "POST"
  })
}
