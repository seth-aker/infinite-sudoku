export interface ServiceResult<T> {
  success: boolean, 
  body?: T,
  error?: string
}
