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
  const isServerUpdate = url.includes('/api/servers/') && method === 'PUT';
  
  if (isServerUpdate) {
    console.log('API REQUEST (Atualização de Servidor):', { url, method });
    console.log('DADOS COMPLETOS:', JSON.stringify(data, null, 2));
    // Verificar especificamente o campo messageSendingWebhookUrl
    if (data && typeof data === 'object') {
      const dataObj = data as any;
      console.log('CAMPO messageSendingWebhookUrl:', dataObj.messageSendingWebhookUrl);
    }
  }
  
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  if (isServerUpdate) {
    console.log('API RESPONSE STATUS (Atualização de Servidor):', res.status);
    try {
      // Clone para não consumir o corpo da resposta
      const clonedRes = res.clone();
      const responseData = await clonedRes.json();
      console.log('API RESPONSE DATA (Atualização de Servidor):', JSON.stringify(responseData, null, 2));
    } catch (e) {
      console.error('Erro ao fazer parse da resposta JSON:', e);
    }
  }

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey[0] as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
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
