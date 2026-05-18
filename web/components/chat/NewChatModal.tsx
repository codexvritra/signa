"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, MessageCircle, Users } from "lucide-react";
import { useChat } from "@/context/ChatProvider";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/cn";

type Mode = "dm" | "group";

export function NewChatModal({
  open,
  onClose,
  prefill,
}: {
  open: boolean;
  onClose: () => void;
  prefill?: string;
}) {
  const { openOrCreateDmWith, createGroupWith, setActiveConversationId } = useChat();
  const [mode, setMode] = useState<Mode>("dm");
  const [dmAddress, setDmAddress] = useState("");
  const [groupName, setGroupName] = useState("");
  const [groupMembers, setGroupMembers] = useState<string[]>([""]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setDmAddress(prefill ?? "");
      setGroupName("");
      setGroupMembers([""]);
      setMode("dm");
    }
  }, [open, prefill]);

  async function startDm() {
    if (busy) return;
    setBusy(true);
    const dm = await openOrCreateDmWith(dmAddress);
    setBusy(false);
    if (dm) {
      setActiveConversationId(dm.id);
      onClose();
    }
  }

  async function startGroup() {
    if (busy) return;
    setBusy(true);
    const filled = groupMembers.map((a) => a.trim()).filter(Boolean);
    const group = await createGroupWith(filled, {
      name: groupName.trim() || undefined,
    });
    setBusy(false);
    if (group) {
      setActiveConversationId(group.id);
      onClose();
    }
  }

  function updateMember(idx: number, value: string) {
    setGroupMembers((prev) => {
      const next = [...prev];
      next[idx] = value;
      return next;
    });
  }

  function addMemberField() {
    setGroupMembers((prev) => [...prev, ""]);
  }

  function removeMemberField(idx: number) {
    setGroupMembers((prev) =>
      prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev,
    );
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="w-full max-w-md glass-strong rounded-2xl p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h2 className="text-lg font-semibold text-white">New chat</h2>
                <p className="text-xs text-white/50 mt-0.5">
                  Start a 1:1 DM or create a group.
                </p>
              </div>
              <button
                onClick={onClose}
                className="text-white/50 hover:text-white p-1 -mr-1 -mt-1"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Mode tabs */}
            <div className="flex gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/10 mb-4">
              <button
                onClick={() => setMode("dm")}
                className={cn(
                  "flex-1 rounded-lg px-3 py-1.5 text-sm font-medium flex items-center justify-center gap-1.5 transition-colors",
                  mode === "dm"
                    ? "bg-white text-black"
                    : "text-white/60 hover:text-white",
                )}
              >
                <MessageCircle className="size-3.5" />
                DM
              </button>
              <button
                onClick={() => setMode("group")}
                className={cn(
                  "flex-1 rounded-lg px-3 py-1.5 text-sm font-medium flex items-center justify-center gap-1.5 transition-colors",
                  mode === "group"
                    ? "bg-white text-black"
                    : "text-white/60 hover:text-white",
                )}
              >
                <Users className="size-3.5" />
                Group
              </button>
            </div>

            {mode === "dm" ? (
              <>
                <input
                  type="text"
                  autoFocus
                  value={dmAddress}
                  onChange={(e) => setDmAddress(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void startDm();
                  }}
                  placeholder="0x…"
                  className="w-full rounded-xl bg-white/[0.03] border border-white/10 px-3 py-2.5 text-sm font-mono text-white outline-none focus:border-white/25 transition-colors"
                />
                <div className="flex justify-end gap-2 mt-4">
                  <button
                    onClick={onClose}
                    className="text-sm text-white/60 hover:text-white px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={startDm}
                    disabled={busy || !dmAddress.trim()}
                    className="brand-gradient text-white text-sm font-medium rounded-lg px-4 py-1.5 hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 transition-opacity"
                  >
                    {busy && <Spinner size={12} />}
                    {busy ? "Opening…" : "Open chat"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <label className="block text-xs text-white/60 mb-1.5">
                  Group name (optional)
                </label>
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="e.g. Alpha squad"
                  className="w-full rounded-xl bg-white/[0.03] border border-white/10 px-3 py-2.5 text-sm text-white outline-none focus:border-white/25 transition-colors mb-3"
                />
                <label className="block text-xs text-white/60 mb-1.5">
                  Members (one address each)
                </label>
                <div className="flex flex-col gap-1.5">
                  {groupMembers.map((m, idx) => (
                    <div key={idx} className="flex gap-1.5">
                      <input
                        type="text"
                        value={m}
                        onChange={(e) => updateMember(idx, e.target.value)}
                        placeholder="0x…"
                        className="flex-1 rounded-xl bg-white/[0.03] border border-white/10 px-3 py-2 text-sm font-mono text-white outline-none focus:border-white/25 transition-colors"
                      />
                      {groupMembers.length > 1 && (
                        <button
                          onClick={() => removeMemberField(idx)}
                          className="text-white/40 hover:text-white p-2"
                          aria-label="Remove"
                        >
                          <X className="size-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    onClick={addMemberField}
                    className="text-xs text-white/60 hover:text-white flex items-center gap-1 self-start px-2 py-1 rounded-lg hover:bg-white/[0.05] transition-colors"
                  >
                    <Plus className="size-3" />
                    Add member
                  </button>
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  <button
                    onClick={onClose}
                    className="text-sm text-white/60 hover:text-white px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={startGroup}
                    disabled={
                      busy || groupMembers.every((m) => !m.trim())
                    }
                    className="brand-gradient text-white text-sm font-medium rounded-lg px-4 py-1.5 hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 transition-opacity"
                  >
                    {busy && <Spinner size={12} />}
                    {busy ? "Creating…" : "Create group"}
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
