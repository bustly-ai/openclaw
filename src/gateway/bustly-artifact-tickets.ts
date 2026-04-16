import { randomBytes } from "node:crypto";

export type BustlyArtifactTicketAction = "preview" | "download" | "archive";

type BustlyArtifactTicketRecord = {
  id: string;
  action: BustlyArtifactTicketAction;
  path: string;
  fileName: string;
  mimeType?: string | null;
  expiresAt: number;
};

const BUSTLY_ARTIFACT_TICKET_PREFIX = "/api/bustly-artifacts";
const BUSTLY_ARTIFACT_TICKET_TTL_MS = 5 * 60 * 1000;
const ticketStore = new Map<string, BustlyArtifactTicketRecord>();

function pruneExpiredTickets(now = Date.now()): void {
  for (const [id, ticket] of ticketStore) {
    if (ticket.expiresAt <= now) {
      ticketStore.delete(id);
    }
  }
}

export function issueBustlyArtifactTicket(params: {
  action: BustlyArtifactTicketAction;
  path: string;
  fileName: string;
  mimeType?: string | null;
  ttlMs?: number;
}): string {
  pruneExpiredTickets();
  const id = randomBytes(18).toString("base64url");
  ticketStore.set(id, {
    id,
    action: params.action,
    path: params.path,
    fileName: params.fileName,
    mimeType: params.mimeType,
    expiresAt: Date.now() + (params.ttlMs ?? BUSTLY_ARTIFACT_TICKET_TTL_MS),
  });
  return `${BUSTLY_ARTIFACT_TICKET_PREFIX}/${id}`;
}

export function resolveBustlyArtifactTicket(
  ticketId: string | null | undefined,
): BustlyArtifactTicketRecord | null {
  if (!ticketId) {
    return null;
  }
  pruneExpiredTickets();
  const ticket = ticketStore.get(ticketId);
  if (!ticket) {
    return null;
  }
  if (ticket.expiresAt <= Date.now()) {
    ticketStore.delete(ticketId);
    return null;
  }
  return ticket;
}

export function isBustlyArtifactTicketPath(pathname: string): boolean {
  return pathname === BUSTLY_ARTIFACT_TICKET_PREFIX
    || pathname.startsWith(`${BUSTLY_ARTIFACT_TICKET_PREFIX}/`);
}

export function parseBustlyArtifactTicketId(pathname: string): string | null {
  if (!isBustlyArtifactTicketPath(pathname)) {
    return null;
  }
  const suffix = pathname.slice(BUSTLY_ARTIFACT_TICKET_PREFIX.length).replace(/^\/+/, "");
  return suffix || null;
}

export function __resetBustlyArtifactTicketsForTest(): void {
  ticketStore.clear();
}
