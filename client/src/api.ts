import type { ReviewResponse } from "./types";

export async function fetchReview(prUrl: string, signal?: AbortSignal): Promise<ReviewResponse> {
  const response = await fetch("/api/review", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prUrl }),
    signal,
  });

  let payload: { error?: string; code?: string } | ReviewResponse | null = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message =
      payload && "error" in payload && payload.error
        ? (payload as { error: string }).error
        : `Request failed with status ${response.status}.`;
    throw new Error(message);
  }

  return payload as ReviewResponse;
}