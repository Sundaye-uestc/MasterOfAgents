import { useMobileUIStore, type PageEntry } from "./stores/mobile-ui.store.js";
import { useNetworkStatus } from "./hooks/useNetworkStatus.js";
import { OfflinePage } from "./pages/OfflinePage.jsx";
import { ConversationListPage } from "./pages/ConversationListPage.jsx";
import { ChatPage } from "./pages/ChatPage.jsx";
import { ApprovalPage } from "./pages/ApprovalPage.jsx";
import { ArtifactPreviewPage } from "./pages/ArtifactPreviewPage.jsx";
import { SettingsPage } from "./pages/SettingsPage.jsx";

function PageRenderer({ entry }: { entry: PageEntry }) {
  switch (entry.name) {
    case "home":
      return <ConversationListPage />;
    case "chat":
      return <ChatPage />;
    case "artifact":
      return <ArtifactPreviewPage />;
    case "approval":
      return <ApprovalPage />;
    case "settings":
      return <SettingsPage />;
    default:
      return null;
  }
}

export function App() {
  const stack = useMobileUIStore((s) => s.stack);
  useNetworkStatus();

  const top: PageEntry | undefined = stack[stack.length - 1];

  if (!top) {
    return null;
  }

  if (top.name === "offline") {
    return <OfflinePage />;
  }

  // Render the top page. We render all pages in the stack but only show the top one,
  // which allows back-navigation animations in the future.
  return <PageRenderer entry={top} />;
}
