export const SIDEBAR_TASKS_REFRESH_EVENT = "openclaw:sidebar-refresh-tasks";
export const SIDEBAR_TASK_RUN_STATE_EVENT = "openclaw:sidebar-task-run-state";

export function notifySidebarTasksRefresh() {
  window.dispatchEvent(new Event(SIDEBAR_TASKS_REFRESH_EVENT));
}

export function notifySidebarTaskRunState(sessionKey: string, running: boolean) {
  window.dispatchEvent(
    new CustomEvent(SIDEBAR_TASK_RUN_STATE_EVENT, {
      detail: { sessionKey, running },
    }),
  );
}
