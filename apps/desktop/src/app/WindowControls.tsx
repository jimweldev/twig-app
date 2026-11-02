import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Copy, Minus, Square, X } from "lucide-react";
import { cn } from "cn";

/** Minimize, maximize/restore and close, drawn by the app since the window has no title bar of its own. */
export function WindowControls() {
  const [maximized, setMaximized] = useState(true);

  useEffect(() => {
    const win = getCurrentWindow();
    const sync = () => win.isMaximized().then(setMaximized, () => undefined);
    sync();
    const off = win.onResized(sync);
    return () => {
      off.then(
        (unlisten) => unlisten(),
        () => undefined,
      );
    };
  }, []);

  const button = (label: string, onClick: () => void, children: React.ReactNode, danger = false) => (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={cn(
        "flex h-full w-11 items-center justify-center text-muted-foreground transition-colors",
        danger ? "hover:bg-red-600 hover:text-white" : "hover:bg-muted hover:text-foreground",
      )}
    >
      {children}
    </button>
  );

  const win = () => getCurrentWindow();
  return (
    <div className="flex h-full shrink-0 items-stretch">
      {button("Minimize", () => win().minimize(), <Minus className="size-4" />)}
      {button(
        maximized ? "Restore" : "Maximize",
        () => win().toggleMaximize(),
        maximized ? <Copy className="size-3.5 -scale-x-100" /> : <Square className="size-3.5" />,
      )}
      {button("Close", () => win().close(), <X className="size-4" />, true)}
    </div>
  );
}
