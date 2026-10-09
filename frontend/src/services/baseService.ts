import { config } from "@/config";
import { safeParseJson } from "@/utils/jsonUtils";
const BASE_URL: string = config.API_BASE_URL;

interface SuccessResult<T> {
  success: true,
  body?: T,
  status: number
};
interface FailureResult {
  success: false,
  error?: string
  status: number
}

interface ResponseErrorBody {
  error: string,
  message: string,
  requestId: string
}
// Singlton to prevent multiple concurrent refresh calls
let refreshPromise: Promise<ServiceResult<void>> | null = null;

export type ServiceResult<T> = SuccessResult<T> | FailureResult
export async function safeFetch<T>(input: RequestInfo | URL, init?: RequestInit, _isRetry = false): Promise<ServiceResult<T>> {
  try {
    const response = await fetch(input, init);
    // intercept 401 errors
    if(response.status === 401 && !_isRetry) {
      if(!refreshPromise) {
        refreshPromise = reauthenticate().finally(() => refreshPromise = null);
      }
      const refreshResult = await refreshPromise;
      if(refreshResult.success) {
        return await safeFetch<T>(input, init, true);
      } else {
        return {
          success: false,
          error: refreshResult.error ?? "Session expired, please log in again.",
          status: refreshResult.status
        }
      }
    }
    const resText = await response.text()
    const contentType = response.headers.get('content-type');
    const isJson = contentType && contentType.includes('application/json')

    if(response.ok) {
      return {
        success: true,
        body: isJson ? safeParseJson<T>(resText) : undefined,
        status: response.status
      }
    } else {
      return {
        success: false,
        error: isJson ? safeParseJson<ResponseErrorBody>(resText)?.message : undefined,
        status: response.status
      }
    }
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? `${e.name}: ${e.message}` : "An unexpected error occured.",
      status: 500,
    }
  }
}

async function reauthenticate(): Promise<ServiceResult<void>> {
  try {
    const response = await fetch(`${BASE_URL}/auth/web/refresh`, {
      method: "POST",
      credentials: 'include',
    })
    if(response.ok) {
      return {
        success: true,
        status: response.status
      }
    } else {
    const resText = await response.text()
    const contentType = response.headers.get('content-type');
    const isJson = contentType && contentType.includes('application/json')
      return {
        success: false,
        status: response.status,
        error: isJson ? safeParseJson<{error: string}>(resText)?.error: undefined
      }
    }
  } catch (e) {
     return {
      success: false,
      error: e instanceof Error ? `${e.name}: ${e.message}` : "An unexpected error occured.",
      status: 500,
    }
  }
}
