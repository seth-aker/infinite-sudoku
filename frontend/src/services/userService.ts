import {config } from '@/config/index'
import type { IUserDto } from '@/stores/userStore'
import type { ServiceResult } from './baseService'
const API_BASE = config.API_BASE_URL

export async function login(username: string, password: string): Promise<ServiceResult<IUserDto>> {
  const body = {username, password}
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    credentials: 'include'
  })
  const result: ServiceResult<IUserDto> = {
    message: res.statusText,
    success: res.ok,
    body: res.ok ? await res.json() : undefined
  }
  return result
}

export async function logout(): Promise<ServiceResult<undefined>> {
  const res = await fetch(`${API_BASE}/auth/logout`, {
    credentials: 'include'
  })
  return {
    message: res.statusText,
    success: res.ok
  }
}

export async function register(username: string, password: string, displayName?: string): Promise<ServiceResult<IUserDto>> {
  const res = await fetch(`${API_BASE}/auth/register`, {
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

  return {
    message: res.statusText,
    success: res.ok,
    body: res.ok ? await JSON.parse(await res.text()) : undefined
  }
}

export async function checkSession(): Promise<ServiceResult<IUserDto>> {
  const res = await fetch(`${API_BASE}/users/me`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    },
    credentials: 'include'    
  })
  if(!res.ok) {
    return {
      message: 'User not authenitcated',
      success: false
    }
  } else {
    return {
      success: true,
      body: await res.json()
    }
  }
}
