"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Progress } from "@/components/ui/progress";

// How often the page reads the pass again while it waits for the worker or runs.
const FOLLOW_MS = 3000;

// The latest pass of the generation engine over the term's tasks (Step 20), as the page read it:
// while it waits for the worker or runs, the page reads it again every few seconds until it ends.
export function TaskGeneration({
  following,
  progress,
  words,
}: {
  following: boolean;
  /** How far a running pass has got, out of 100. */
  progress?: number;
  words: { title: string; status: string; changes?: string; progress: string };
}) {
  const router = useRouter();
  useEffect(() => {
    if (!following) return;
    const timer = setInterval(() => router.refresh(), FOLLOW_MS);
    return () => clearInterval(timer);
  }, [following, router]);

  return (
    <div className="mt-4 rounded-lg border px-4 py-3">
      <h3 className="font-medium text-sm">{words.title}</h3>
      <output className="mt-1 block text-muted-foreground text-sm">
        <span className="block">{words.status}</span>
        {words.changes ? (
          <span className="mt-1 block">{words.changes}</span>
        ) : null}
      </output>
      {progress === undefined ? null : (
        <Progress
          value={progress}
          aria-label={words.progress}
          className="mt-3"
        />
      )}
    </div>
  );
}
