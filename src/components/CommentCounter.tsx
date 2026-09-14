"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
export function CommentCounter() {
  const [count, setCount] = useState<number | null>(null);
  const pathname = usePathname();
  useEffect(() => {
    const controller = new AbortController();
    let pending = false;
    async function refresh() {
      if (pending || document.hidden) return;
      pending = true;
      try {
        const response = await fetch("/api/comments/count", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error();
        const data = await response.json();
        if (!Number.isSafeInteger(data.count) || data.count < 0)
          throw new Error();
        if (!controller.signal.aborted) setCount(data.count);
      } catch {
        if (!controller.signal.aborted) setCount(null);
      } finally {
        pending = false;
      }
    }
    void refresh();
    const interval = setInterval(() => void refresh(), 60000);
    const update = () => void refresh();
    window.addEventListener("focus", update);
    window.addEventListener("comments-changed", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      controller.abort();
      clearInterval(interval);
      window.removeEventListener("focus", update);
      window.removeEventListener("comments-changed", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, [pathname]);
  return (
    <Link
      href="/comments"
      className="comment-counter"
      aria-label={
        count === null
          ? "Comments — count unavailable"
          : `${count} total ${count === 1 ? "comment" : "comments"}`
      }
    >
      <span>Comments</span>
      <strong aria-live="polite">
        {count === null ? "—" : count.toLocaleString("en")}
      </strong>
    </Link>
  );
}
