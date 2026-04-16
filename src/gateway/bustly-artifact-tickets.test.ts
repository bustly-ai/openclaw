import { describe, expect, it } from "vitest";
import {
  __resetBustlyArtifactTicketsForTest,
  issueBustlyArtifactTicket,
  parseBustlyArtifactTicketId,
  resolveBustlyArtifactTicket,
} from "./bustly-artifact-tickets.js";

describe("bustly artifact tickets", () => {
  it("issues resolvable ticket paths", () => {
    __resetBustlyArtifactTicketsForTest();
    const routePath = issueBustlyArtifactTicket({
      action: "preview",
      path: "/tmp/workspaces/ws-1/agents/overview/output.png",
      fileName: "output.png",
      mimeType: "image/png",
    });
    const ticketId = parseBustlyArtifactTicketId(routePath);
    expect(ticketId).toBeTruthy();
    expect(resolveBustlyArtifactTicket(ticketId)).toEqual(
      expect.objectContaining({
        action: "preview",
        path: "/tmp/workspaces/ws-1/agents/overview/output.png",
        fileName: "output.png",
        mimeType: "image/png",
      }),
    );
  });

  it("expires tickets after their ttl", async () => {
    __resetBustlyArtifactTicketsForTest();
    const routePath = issueBustlyArtifactTicket({
      action: "download",
      path: "/tmp/workspaces/ws-1/agents/overview/output.txt",
      fileName: "output.txt",
      ttlMs: 1,
    });
    const ticketId = parseBustlyArtifactTicketId(routePath);
    expect(ticketId).toBeTruthy();
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(resolveBustlyArtifactTicket(ticketId)).toBeNull();
  });
});
