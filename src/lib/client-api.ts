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
  if (!response.ok) throw new Error(data.error || "Request failed. Try again.");
  return data as T;
}
