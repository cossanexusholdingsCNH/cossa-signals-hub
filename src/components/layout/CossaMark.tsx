import { cn } from "@/lib/utils";

/** Cossa Nexus Holdings mark — interlocking gold nexus. */
export function CossaMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={cn("shrink-0", className)}
    >
      <path
        d="M16 2 29 9.5v13L16 30 3 22.5v-13L16 2Z"
        stroke="currentColor"
        strokeWidth="1.5"
        className="text-primary"
      />
      <path
        d="M16 9.5 22.5 13v6L16 22.5 9.5 19v-6L16 9.5Z"
        fill="currentColor"
        className="text-primary/25"
      />
      <path d="M16 9.5v13M9.5 13l13 6M22.5 13l-13 6" stroke="currentColor" strokeWidth="1" className="text-primary/70" />
    </svg>
  );
}
