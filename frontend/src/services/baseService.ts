import { safeParseJson } from "@/utils/jsonUtils";

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
export type ServiceResult<T> = SuccessResult<T> | FailureResult
export async function safeFetch<T>(input: RequestInfo | URL, init?: RequestInit): Promise<ServiceResult<T>> {
  try {
    const response = await fetch(input, init);
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
