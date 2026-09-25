// Attempts to parse JSON string, if it fails, returns undefined.
export function safeParseJson<T>(object: string) {
  try {
    return JSON.parse(object) as T;
  } catch (error) {
    return undefined;
  }
}
