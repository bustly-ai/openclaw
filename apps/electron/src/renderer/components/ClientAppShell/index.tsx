import { useState, type ReactNode } from "react";
import { ClientAppSidebar } from "./Sidebar";

type ClientAppShellProps = {
  activePage: "chat" | "skill";
  chatPage: ReactNode;
  skillPage?: ReactNode;
};

export default function ClientAppShell({ activePage, chatPage, skillPage }: ClientAppShellProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#E9ECF1] font-sans">
      <div className="z-20 h-full shrink-0">
        <ClientAppSidebar
          collapsed={collapsed}
          onToggleCollapsed={() => {
            setCollapsed((prev) => !prev);
          }}
        />
      </div>

      <main className="relative flex-1 overflow-hidden">
        <div className="h-full overflow-hidden bg-white">
          <div className={activePage === "chat" ? "h-full" : "hidden"}>{chatPage}</div>
          {skillPage ? <div className={activePage === "skill" ? "h-full" : "hidden"}>{skillPage}</div> : null}
        </div>
      </main>
    </div>
  );
}
