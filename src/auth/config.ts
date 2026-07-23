const CLIENT_ID_KEY = "dag-demo:github-client-id";
const PROXY_URL_KEY = "dag-demo:token-proxy-url";

export interface AuthConfig {
  clientId: string;
  proxyUrl: string;
}

export function getAuthConfig(): AuthConfig {
  return {
    clientId: localStorage.getItem(CLIENT_ID_KEY) ?? "",
    proxyUrl: localStorage.getItem(PROXY_URL_KEY) ?? "",
  };
}

export function setAuthConfig(config: AuthConfig): void {
  localStorage.setItem(CLIENT_ID_KEY, config.clientId.trim());
  localStorage.setItem(PROXY_URL_KEY, config.proxyUrl.trim().replace(/\/+$/, ""));
}

export function isAuthConfigured(): boolean {
  const { clientId, proxyUrl } = getAuthConfig();
  return clientId.length > 0 && proxyUrl.length > 0;
}
