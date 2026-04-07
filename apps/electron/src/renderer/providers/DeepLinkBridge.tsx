import { useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAppState } from "./AppStateProvider";

function sanitizeDeepLinkRoute(route: string | null, workspaceId: string | null): string | null {
  if (!route) {
    return null;
  }
  const normalizedWorkspaceId = workspaceId?.trim() || "";
  if (!normalizedWorkspaceId) {
    return route;
  }

  try {
    const parsed = new URL(route, "https://bustly.local");
    parsed.searchParams.delete("workspace_id");
    parsed.searchParams.delete("workspaceId");
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return route;
  }
}

export default function DeepLinkBridge() {
  const { checking, loggedIn } = useAppState();
  const navigate = useNavigate();
  const pendingDeepLinksRef = useRef<DeepLinkData[]>([]);
  const handlingRef = useRef(false);

  const applyDeepLink = useCallback(async (data: DeepLinkData) => {
    console.log("[DeepLinkBridge] apply", data);
    const nextWorkspaceId = data.workspaceId?.trim() || "";
    if (nextWorkspaceId) {
      try {
        const currentConfig = await window.electronAPI.bustlyGetSupabaseConfig();
        const currentWorkspaceId = currentConfig?.workspaceId?.trim() || "";
        console.log("[DeepLinkBridge] workspace check", {
          currentWorkspaceId,
          nextWorkspaceId,
        });
        if (currentWorkspaceId !== nextWorkspaceId) {
          const switchResult = await window.electronAPI.bustlySetActiveWorkspace(nextWorkspaceId);
          console.log("[DeepLinkBridge] switch result", switchResult);
          if (!switchResult.success) {
            console.warn("[DeepLink] Failed to switch workspace", {
              workspaceId: nextWorkspaceId,
              error: switchResult.error ?? "Unknown error",
            });
          }
        }
      } catch (error) {
        console.warn("[DeepLink] Workspace switch failed", {
          workspaceId: nextWorkspaceId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const route = sanitizeDeepLinkRoute(data.route, data.workspaceId);
    console.log("[DeepLinkBridge] navigate", {
      originalRoute: data.route,
      sanitizedRoute: route,
    });
    if (!route) {
      return;
    }
    if (route === "/") {
      void navigate("/", { replace: true });
      return;
    }
    void navigate(route, { replace: true });
  }, [navigate]);

  const drainPendingDeepLinks = useCallback(async () => {
    if (handlingRef.current || checking || !loggedIn) {
      console.log("[DeepLinkBridge] skip drain", {
        handling: handlingRef.current,
        checking,
        loggedIn,
        queued: pendingDeepLinksRef.current.length,
      });
      return;
    }
    handlingRef.current = true;
    try {
      console.log("[DeepLinkBridge] start drain", {
        queued: pendingDeepLinksRef.current.length,
      });
      while (pendingDeepLinksRef.current.length > 0 && !checking && loggedIn) {
        const next = pendingDeepLinksRef.current.shift();
        if (!next) {
          continue;
        }
        await applyDeepLink(next);
      }
    } finally {
      handlingRef.current = false;
      if (pendingDeepLinksRef.current.length > 0 && !checking && loggedIn) {
        void drainPendingDeepLinks();
      }
    }
  }, [applyDeepLink, checking, loggedIn]);

  const enqueueDeepLink = useCallback((data: DeepLinkData | null) => {
    if (!data) {
      console.log("[DeepLinkBridge] enqueue ignored: empty payload");
      return;
    }
    console.log("[DeepLinkBridge] enqueue", data);
    pendingDeepLinksRef.current.push(data);
    if (!checking && loggedIn) {
      void drainPendingDeepLinks();
    }
  }, [checking, drainPendingDeepLinks, loggedIn]);

  useEffect(() => {
    if (!window.electronAPI) {
      return;
    }
    void window.electronAPI.consumePendingDeepLink().then((data) => {
      enqueueDeepLink(data);
    });
    const unsubscribe = window.electronAPI.onDeepLink((data) => {
      enqueueDeepLink(data);
    });
    return () => {
      unsubscribe();
    };
  }, [enqueueDeepLink]);

  useEffect(() => {
    if (!checking && loggedIn) {
      void drainPendingDeepLinks();
    }
  }, [checking, drainPendingDeepLinks, loggedIn]);

  return null;
}
