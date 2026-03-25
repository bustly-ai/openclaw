export function createGatewayInstanceId(scope: string): string {
  const randomPart =
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `bustly-electron-${scope}-${randomPart}`;
}
