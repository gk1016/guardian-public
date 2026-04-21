"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";

type NotificationAckFormProps = {
  notificationId: string;
  disabled?: boolean;
};

export function NotificationAckForm({
  notificationId,
  disabled = false,
}: NotificationAckFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleAcknowledge() {
    startTransition(async () => {
      await fetch(`/api/notifications/${notificationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "acknowledged" }),
      });
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      disabled={disabled || isPending}
      onClick={handleAcknowledge}
      className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-70"
    >
      {isPending ? <LoaderCircle size={14} className="animate-spin" /> : null}
      Acknowledge
    </button>
  );
}
