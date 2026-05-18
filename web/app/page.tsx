"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { AppHeader } from "@/components/shell/AppHeader";
import { Landing } from "@/components/shell/Landing";
import { AppShell } from "@/components/shell/AppShell";

export default function Home() {
  const { isConnected } = useAccount();
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader onOpenSettings={isConnected ? () => setSettingsOpen(true) : undefined} />
      {isConnected ? (
        <AppShell
          settingsOpen={settingsOpen}
          onCloseSettings={() => setSettingsOpen(false)}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      ) : (
        <Landing />
      )}
    </div>
  );
}
