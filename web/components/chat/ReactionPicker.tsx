"use client";

import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/cn";

const QUICK_REACTIONS = ["❤️", "🔥", "👍", "😂", "😮", "🙏"];

export function ReactionPicker({
  open,
  onPick,
  align,
}: {
  open: boolean;
  onPick: (emoji: string) => void;
  align: "left" | "right";
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 4 }}
          transition={{ duration: 0.14 }}
          className={cn(
            "absolute -top-9 z-10 glass-strong rounded-full px-1.5 py-1 flex gap-0.5 shadow-xl",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          {QUICK_REACTIONS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => onPick(emoji)}
              className="size-7 rounded-full text-base hover:bg-white/10 transition-colors flex items-center justify-center"
            >
              {emoji}
            </button>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
