export const ELECTRON_OPENCLAW_PROFILE = "bustly";
export const ELECTRON_DEFAULT_MODEL = "openrouter/minimax/minimax-m2.5";

export function getElectronOpenrouterApiKey(): string {
  return process.env.BUSTLY_BETA_OPENROUTER_API_KEY?.trim() || "";
}
