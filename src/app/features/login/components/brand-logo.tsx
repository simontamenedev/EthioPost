import Image from "next/image";

/* ---------- brand assets (served from /public/brand) ----------
   Official files only — never recolor, stretch or redraw the logo.
   white   → on Post Finance Blue / dark surfaces
   primary → on white
   Pass ONLY a height class (h-14, h-10). SVGs are served as-is (unoptimized). */
export function Logo({ variant, className = "", priority = false }: { variant: "white" | "primary"; className?: string; priority?: boolean }) {
  return (
    <Image
      src={`/brand/logo-${variant}.svg`}
      alt="Post Finance"
      width={555}
      height={217}
      priority={priority}
      unoptimized
      draggable={false}
      className={`block w-auto max-w-none select-none ${className}`}
    />
  );
}
