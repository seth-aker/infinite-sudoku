export interface ServiceResult<T> {
  message?: string,
  success: boolean
  body?: T
}