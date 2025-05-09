import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  try {
    const res = await fetch(url, {
      method,
      headers: data ? { "Content-Type": "application/json" } : {},
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include",
    });

    // Se a resposta não for JSON, trate como texto
    const contentType = res.headers.get("content-type");
    if (!res.ok) {
      // Se o tipo de conteúdo não for JSON, trate como texto
      if (contentType && !contentType.includes("application/json")) {
        const text = await res.text();
        throw new Error(`${res.status}: ${text}`);
      }
      
      // Tente obter o erro como JSON
      try {
        const errorData = await res.json();
        throw new Error(errorData.message || `Erro ${res.status}: ${res.statusText}`);
      } catch (jsonError) {
        // Se não conseguir processar como JSON, use o statusText
        throw new Error(`${res.status}: ${res.statusText}`);
      }
    }

    return res;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Erro desconhecido na requisição");
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    try {
      const res = await fetch(queryKey[0] as string, {
        credentials: "include",
      });

      if (unauthorizedBehavior === "returnNull" && res.status === 401) {
        return null;
      }

      if (!res.ok) {
        // Se o tipo de conteúdo não for JSON, trate como texto
        const contentType = res.headers.get("content-type");
        if (contentType && !contentType.includes("application/json")) {
          const text = await res.text();
          throw new Error(`${res.status}: ${text}`);
        }
        
        // Tente obter o erro como JSON
        try {
          const errorData = await res.json();
          throw new Error(errorData.message || `Erro ${res.status}: ${res.statusText}`);
        } catch (jsonError) {
          // Se não conseguir processar como JSON, use o statusText
          throw new Error(`${res.status}: ${res.statusText}`);
        }
      }

      return await res.json();
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error("Erro desconhecido na requisição");
    }
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
