import { config } from "@/config";
import { safeFetch, type ServiceResult } from "./baseService";
const BASE_URL: string = config.API_BASE_URL;
export interface UserDto {
  id: string;
  displayName?: string;
  username: string;
  imageUrl?: string;
  currentPuzzleId?: string;
  role: string;
}

export async function login(
  username: string,
  password: string,
): Promise<ServiceResult<UserDto>> {
  return await safeFetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ username, password }),
  });
}
export async function logout(): Promise<ServiceResult<void>> {
  return await safeFetch(`${BASE_URL}/auth/logout`, {
    method: "POST",
    credentials: "include",
  });
}
export async function getSession(): Promise<
  ServiceResult<UserDto | undefined>
> {
  return await safeFetch(`${BASE_URL}/auth/session`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
  });
}
export async function register(
  username: string,
  password: string,
  displayName?: string,
): Promise<ServiceResult<UserDto | undefined>> {
  return await safeFetch(`${BASE_URL}/auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify({
      username,
      password,
      displayName,
    }),
  });
}

export async function validateEmail(token: string): Promise<ServiceResult<void>> {
  return await safeFetch(`${BASE_URL}/auth/validateEmail?token=${token}`, {
    method: "POST"
  })
}
