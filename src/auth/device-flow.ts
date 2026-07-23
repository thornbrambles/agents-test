import { getAuthConfig } from "./config";

export interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

export interface GithubUser {
  login: string;
  avatar_url: string;
  html_url: string;
}

const SESSION_TOKEN_KEY = "dag-demo:github-token";

export class DeviceFlowError extends Error {}

/** Step 1: ask GitHub (via the token proxy, for CORS) for a device + user code pair. */
export async function requestDeviceCode(): Promise<DeviceCodeResponse> {
  const { clientId, proxyUrl } = getAuthConfig();
  if (!clientId || !proxyUrl) {
    throw new DeviceFlowError("GitHub client ID and token proxy URL must be configured first.");
  }

  const res = await fetch(`${proxyUrl}/device/code`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ client_id: clientId, scope: "read:user" }),
  });
  if (!res.ok) {
    throw new DeviceFlowError(`Failed to request a device code (HTTP ${res.status}).`);
  }
  return res.json();
}

/**
 * Step 2: poll for the user to approve the code at verification_uri.
 * Resolves once GitHub hands back an access token.
 */
export async function pollForToken(
  device: DeviceCodeResponse,
  onTick?: (secondsLeft: number) => void,
): Promise<string> {
  const { clientId, proxyUrl } = getAuthConfig();
  let intervalMs = device.interval * 1000;
  const deadline = Date.now() + device.expires_in * 1000;

  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
    onTick?.(Math.max(0, Math.round((deadline - Date.now()) / 1000)));

    const res = await fetch(`${proxyUrl}/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        device_code: device.device_code,
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      }),
    });
    const data = await res.json();

    if (data.access_token) {
      sessionStorage.setItem(SESSION_TOKEN_KEY, data.access_token);
      return data.access_token;
    }

    switch (data.error) {
      case "authorization_pending":
        continue;
      case "slow_down":
        intervalMs += 5000;
        continue;
      case "expired_token":
        throw new DeviceFlowError("The login code expired. Start over.");
      case "access_denied":
        throw new DeviceFlowError("Login was denied.");
      default:
        throw new DeviceFlowError(data.error_description ?? "Login failed.");
    }
  }

  throw new DeviceFlowError("The login code expired. Start over.");
}

export function getStoredToken(): string | null {
  return sessionStorage.getItem(SESSION_TOKEN_KEY);
}

export function signOut(): void {
  sessionStorage.removeItem(SESSION_TOKEN_KEY);
}

export async function fetchUser(token: string): Promise<GithubUser> {
  const res = await fetch("https://api.github.com/user", {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
  });
  if (!res.ok) throw new DeviceFlowError(`Failed to fetch GitHub profile (HTTP ${res.status}).`);
  return res.json();
}
