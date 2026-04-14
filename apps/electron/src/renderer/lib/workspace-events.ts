export const BUSTLY_WORKSPACE_SWITCH_EVENT = "openclaw:workspace-switched";

export function notifyBustlyWorkspaceSwitched(): void {
  window.dispatchEvent(new Event(BUSTLY_WORKSPACE_SWITCH_EVENT));
}
