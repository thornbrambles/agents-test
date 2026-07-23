import { getAuthConfig, isAuthConfigured, setAuthConfig } from "../auth/config";
import {
  DeviceFlowError,
  fetchUser,
  getStoredToken,
  pollForToken,
  requestDeviceCode,
  signOut,
  type GithubUser,
} from "../auth/device-flow";

export function initAuthPanel(): void {
  const panel = document.getElementById("auth-panel")!;
  const settingsDialog = document.getElementById("settings-dialog") as HTMLDialogElement;
  const deviceDialog = document.getElementById("device-dialog") as HTMLDialogElement;
  const clientIdInput = document.getElementById("client-id-input") as HTMLInputElement;
  const proxyUrlInput = document.getElementById("proxy-url-input") as HTMLInputElement;
  const verificationLink = document.getElementById("device-verification-link") as HTMLAnchorElement;
  const deviceCodeEl = document.getElementById("device-code")!;
  const deviceStatusEl = document.getElementById("device-status")!;

  document.getElementById("settings-save-btn")!.addEventListener("click", () => {
    setAuthConfig({ clientId: clientIdInput.value, proxyUrl: proxyUrlInput.value });
    settingsDialog.close();
    beginSignIn();
  });
  document.getElementById("settings-cancel-btn")!.addEventListener("click", () => settingsDialog.close());
  document.getElementById("device-cancel-btn")!.addEventListener("click", () => deviceDialog.close());

  function renderSignedOut(): void {
    panel.innerHTML = "";
    const gear = button("Settings", () => openSettings());
    gear.className = "secondary";
    const signIn = button("Sign in with GitHub", () => beginSignIn());
    panel.append(gear, signIn);
  }

  function renderSignedIn(user: GithubUser): void {
    panel.innerHTML = "";
    const info = document.createElement("div");
    info.className = "user";
    const img = document.createElement("img");
    img.src = user.avatar_url;
    img.alt = "";
    const name = document.createElement("a");
    name.href = user.html_url;
    name.target = "_blank";
    name.rel = "noopener";
    name.textContent = user.login;
    info.append(img, name);
    const out = button("Sign out", () => {
      signOut();
      renderSignedOut();
    });
    out.className = "secondary";
    panel.append(info, out);
  }

  function button(text: string, onClick: () => void): HTMLButtonElement {
    const b = document.createElement("button");
    b.textContent = text;
    b.addEventListener("click", onClick);
    return b;
  }

  function openSettings(): void {
    const { clientId, proxyUrl } = getAuthConfig();
    clientIdInput.value = clientId;
    proxyUrlInput.value = proxyUrl;
    settingsDialog.showModal();
  }

  async function beginSignIn(): Promise<void> {
    if (!isAuthConfigured()) {
      openSettings();
      return;
    }
    try {
      const device = await requestDeviceCode();
      verificationLink.href = device.verification_uri;
      verificationLink.textContent = device.verification_uri;
      deviceCodeEl.textContent = device.user_code;
      deviceStatusEl.textContent = "Waiting for you to approve in the browser…";
      deviceDialog.showModal();

      const token = await pollForToken(device, (secondsLeft) => {
        deviceStatusEl.textContent = `Waiting for you to approve in the browser… (code expires in ${secondsLeft}s)`;
      });
      deviceDialog.close();
      const user = await fetchUser(token);
      renderSignedIn(user);
    } catch (err) {
      deviceDialog.close();
      const message = err instanceof DeviceFlowError ? err.message : "Sign-in failed.";
      alert(message);
    }
  }

  const existingToken = getStoredToken();
  if (existingToken) {
    fetchUser(existingToken)
      .then(renderSignedIn)
      .catch(() => {
        signOut();
        renderSignedOut();
      });
  } else {
    renderSignedOut();
  }
}
