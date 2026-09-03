import { useEffect, type ReactNode } from "react";
import { useAuth } from "@clerk/react";
import { api } from "../lib/api";

export function AxiosAuthBridge({ children }: { children: ReactNode }) {
  const { getToken } = useAuth();

  useEffect(() => {
    const interceptor = api.interceptors.request.use(async (config) => {
      const token = await getToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    return () => {
      api.interceptors.request.eject(interceptor);
    };
  }, [getToken]);

  return children;
}
