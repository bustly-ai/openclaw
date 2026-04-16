import { importBustlyPathFile } from "../../bustly/path-import.js";
import { ErrorCodes, errorShape } from "../protocol/index.js";
import type { GatewayRequestHandlers } from "./types.js";

export const bustlyPathImportHandlers: GatewayRequestHandlers = {
  "bustly.path.import": async ({ params, respond }) => {
    const contentBase64 = typeof params.contentBase64 === "string" ? params.contentBase64.trim() : "";
    if (!contentBase64) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "contentBase64 is required"));
      return;
    }
    try {
      const imported = await importBustlyPathFile({
        name: typeof params.name === "string" ? params.name : undefined,
        relativePath: typeof params.relativePath === "string" ? params.relativePath : undefined,
        contentBase64,
      });
      respond(true, imported);
    } catch (error) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          error instanceof Error ? error.message : "Failed to import file.",
        ),
      );
    }
  },
};
