
import { config } from "@/config";
import type { ServiceResult } from "./baseService";
const BASE_URL: string = config.API_BASE_URL;
export interface UserDto {
  id: string,
  displayName?: string,
  username: string,
  imageUrl?: string,
  currentPuzzleId?: string,
  role: string
}

export async function login(username: string, password: string): Promise<ServiceResult<UserDto>> {
  const result = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    credentials: 'include',
    body: JSON.stringify({username, password})
  })
  if(!result.ok) {
    return {
      success: false,
      error: await result.text()
    }
  }
  return {
    success: true,
    body: await result.json()
  }
}
export async function logout(): Promise<ServiceResult<void>> {
  const result = await fetch(`${BASE_URL}/auth/logout`, {
    method: 'POST',
    credentials: 'include'
  })
  if(!result.ok) {
    return {
      success: false,
      error: await result.text()
    }
  }
  return {
    success: true
  }
}
export async function getSession(): Promise<ServiceResult<UserDto | undefined>> {
  const result = await fetch(`${BASE_URL}/auth/session`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json'},
    credentials: 'include'
  })
  if(!result.ok) {
    return {
      success: false,
      error: await result.text()
    }
  }
  const body = await result.json()
  if(!body) {
    return {
      success: false,
      error: 'No session found!'
    }
  }
  return {
    success: true,
    body
  }
}

export async function register(username: string, password: string, displayName?: string): Promise<ServiceResult<UserDto | undefined>> {
  const result = await fetch(`${BASE_URL}/auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    credentials: 'include',
    body: JSON.stringify({
      username,
      password,
      displayName
    })
  })
  if(!result.ok) {
    return {
      success: false,
      error: await result.text()
    }
  }
  return {
    success: true,
    body: await result.json()
  }
}
