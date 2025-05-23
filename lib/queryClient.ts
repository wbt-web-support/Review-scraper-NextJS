import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    let errorBody;
    try {
      errorBody = await res.json(); 
    } catch {
      errorBody = { message: (await res.text()) || res.statusText };
    }
    throw new Error(errorBody.message || `${res.status}: Request failed`);
  }
}
export async function apiRequest<T = unknown>( 
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<T> { 
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include", 
  });

  await throwIfResNotOk(res); 
  if (res.status === 204 || res.headers.get('Content-Length') === '0') {
    return undefined as T; 
  }

  return res.json() as Promise<T>; 
}
type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn = <T>(options?: {
  on401?: UnauthorizedBehavior; 
}): QueryFunction<T> =>
  async ({ queryKey }: { queryKey: readonly unknown[] }) => {
    const url = queryKey[0] as string;
    const unauthorizedBehavior = options?.on401 || "throw";
    const res = await fetch(url, {
      credentials: "include",
    });
    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null as T;
    }
    await throwIfResNotOk(res);
    if (res.status === 204 || res.headers.get('Content-Length') === '0') {
      return undefined as T;
    }
    return res.json() as Promise<T>;
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5, 
      retry: (failureCount, error: Error) => {
        if (error.message?.includes('401') || error.message?.includes('403') || error.message?.includes('404')) {
          return false;
        }
        return failureCount < 2; 
      },
    },
    mutations: {
      retry: false,
    },
  },
});