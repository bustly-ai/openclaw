const BUSTLY_WORKSPACE_HEADER = "X-Workspace-Id";
const BUSTLY_RUN_ID_HEADER = "X-Run-Id";
const BUSTLY_SESSION_ID_HEADER = "X-Session-Id";

export function mergeBustlyRuntimeHeaders(params: {
  modelHeaders?: Record<string, string>;
  optionHeaders?: Record<string, string>;
  workspaceId?: string;
  runId: string;
  sessionId?: string;
}): Record<string, string> {
  const mergedHeaders = {
    ...(params.modelHeaders ?? {}),
    ...(params.optionHeaders ?? {}),
  };
  mergedHeaders[BUSTLY_RUN_ID_HEADER] = params.runId;
  const sessionId = params.sessionId?.trim() ?? "";
  if (sessionId) {
    mergedHeaders[BUSTLY_SESSION_ID_HEADER] = sessionId;
  } else {
    delete mergedHeaders[BUSTLY_SESSION_ID_HEADER];
    delete mergedHeaders[BUSTLY_SESSION_ID_HEADER.toLowerCase()];
  }
  const workspaceId = params.workspaceId?.trim() ?? "";
  if (workspaceId) {
    mergedHeaders[BUSTLY_WORKSPACE_HEADER] = workspaceId;
  } else {
    delete mergedHeaders[BUSTLY_WORKSPACE_HEADER];
    delete mergedHeaders[BUSTLY_WORKSPACE_HEADER.toLowerCase()];
  }
  return mergedHeaders;
}
