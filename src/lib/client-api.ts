/** A refusal from Tenjō's API, keeping its code and any fields a screen can act on. */
export class ApiError extends Error {
  constructor(
    message: string,
    public code = "",
    public details: Record<string, unknown> = {},
  ) {
    super(message);
  }
}
export async function api<T>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      signal: AbortSignal.timeout(25000),
    });
  } catch {
    throw new Error(
      "Connection interrupted. Check the public record before trying again.",
    );
  }
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(
      "The server returned an unreadable response. Refresh and try again.",
    );
  }
  if (!response.ok)
    throw new ApiError(
      data.error || "Request failed. Try again.",
      data.code,
      data,
    );
  return data as T;
}
