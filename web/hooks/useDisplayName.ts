"use client";

import { useEffect, useState } from "react";
import {
  getDisplayName,
  onDisplayNameChange,
  setDisplayName,
  emitDisplayNameChange,
} from "@/lib/prefs";

export function useDisplayName(): [string, (n: string) => void] {
  const [name, setNameState] = useState<string>("");

  useEffect(() => {
    setNameState(getDisplayName());
    return onDisplayNameChange(() => setNameState(getDisplayName()));
  }, []);

  function set(n: string) {
    setDisplayName(n);
    setNameState(n.trim());
    emitDisplayNameChange();
  }

  return [name, set];
}
