import fetch from 'node-fetch';

const API_ENDPOINT = '/api/scheduled/fetch-reviews';
const TIMEOUT = 300000; // 5 minutes

function getBaseUrl(providedBaseUrl?: string) {
  if (providedBaseUrl) return providedBaseUrl;
  if (typeof window !== 'undefined' && window.location) {
    return window.location.origin;
  }
  return 'http://localhost:3000';
}

export async function runScheduledReviewFetch({ source, baseUrl }: { source?: string, baseUrl?: string }) {
  const API_BASE_URL = getBaseUrl(baseUrl);
  console.log('API_BASE_URL***************************', API_BASE_URL);
  const url = `${API_BASE_URL}${API_ENDPOINT}`;
  const body = source ? JSON.stringify({ source }) : '{}';

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'ScheduledReviewFetch/1.0',
      },
      body,
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.message || `HTTP error ${res.status}`);
    }
    return data;
  } catch (error: any) {
    clearTimeout(timeout);
    throw new Error(error.message || 'Failed to fetch reviews');
  }
}
