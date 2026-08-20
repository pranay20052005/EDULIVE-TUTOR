import { cn } from "@/lib/utils";

interface BookLoaderProps {
  /**
   * Status or loading text shown beneath the book.
   * @default "Loading your session…"
   */
  text?: string;
  /**
   * Optional secondary subtitle text.
   */
  subtitle?: string;
  /**
   * Visual size of the book loader.
   * @default "md"
   */
  size?: "sm" | "md" | "lg";
  /**
   * Whether to wrap in a full-screen centered container with background.
   * @default false
   */
  fullScreen?: boolean;
  /**
   * Additional container CSS classes.
   */
  className?: string;
}

const sizeConfig = {
  sm: {
    book: "w-10 h-7",
    cover: "-inset-x-0.5 -bottom-0.5 h-1.5",
    lines: "h-0.5 my-0.5",
    shadow: "w-9 h-1.5",
    text: "text-xs",
    gap: "gap-2.5",
  },
  md: {
    book: "w-14 h-9",
    cover: "-inset-x-1 -bottom-1 h-2",
    lines: "h-0.5 my-1",
    shadow: "w-12 h-2",
    text: "text-sm",
    gap: "gap-3.5",
  },
  lg: {
    book: "w-20 h-13",
    cover: "-inset-x-1.5 -bottom-1.5 h-2.5",
    lines: "h-1 my-1.5",
    shadow: "w-16 h-2.5",
    text: "text-base",
    gap: "gap-4",
  },
};

export function BookLoader({
  text = "Loading your session…",
  subtitle,
  size = "md",
  fullScreen = false,
  className,
}: BookLoaderProps) {
  const cfg = sizeConfig[size];

  const content = (
    <div
      role="status"
      aria-label={text}
      className={cn("flex flex-col items-center justify-center select-none", cfg.gap, className)}
    >
      {/* 3D Animated Book Container */}
      <div className="relative flex flex-col items-center">
        <div className={cn("book-loader-container relative", cfg.book)}>
          {/* Book Outer Cover / Binding Base */}
          <div className={cn("absolute inset-0 rounded-[4px] bg-primary shadow-sm", cfg.cover)} />

          {/* Static Left Page (Open Book Left Half) */}
          <div className="absolute left-0 top-0 w-1/2 h-full bg-card rounded-l-[3px] border-y border-l border-primary/20 p-1 flex flex-col justify-center overflow-hidden shadow-inner">
            <div className={cn("w-3/4 rounded-full bg-primary/20", cfg.lines)} />
            <div className={cn("w-full rounded-full bg-muted-foreground/15", cfg.lines)} />
            <div className={cn("w-4/5 rounded-full bg-muted-foreground/15", cfg.lines)} />
          </div>

          {/* Static Right Page (Open Book Right Half) */}
          <div className="absolute right-0 top-0 w-1/2 h-full bg-card rounded-r-[3px] border-y border-r border-primary/20 p-1 flex flex-col justify-center overflow-hidden shadow-inner">
            <div className={cn("w-full rounded-full bg-muted-foreground/15", cfg.lines)} />
            <div className={cn("w-4/5 rounded-full bg-muted-foreground/15", cfg.lines)} />
            <div className={cn("w-2/3 rounded-full bg-primary/20", cfg.lines)} />
          </div>

          {/* Center Spine Divider */}
          <div className="absolute left-1/2 top-0 -translate-x-1/2 w-[2px] h-full bg-primary/30 z-20" />

          {/* Flipping Page Leaf 1 */}
          <div className="book-page-leaf leaf-1 absolute left-1/2 top-0 w-1/2 h-full bg-card/95 rounded-r-[3px] border-y border-r border-primary/30 p-1 flex flex-col justify-center overflow-hidden shadow-sm">
            <div className={cn("w-3/4 rounded-full bg-primary/25", cfg.lines)} />
            <div className={cn("w-full rounded-full bg-muted-foreground/20", cfg.lines)} />
            <div className={cn("w-2/3 rounded-full bg-muted-foreground/20", cfg.lines)} />
          </div>

          {/* Flipping Page Leaf 2 */}
          <div className="book-page-leaf leaf-2 absolute left-1/2 top-0 w-1/2 h-full bg-card/95 rounded-r-[3px] border-y border-r border-primary/30 p-1 flex flex-col justify-center overflow-hidden shadow-sm">
            <div className={cn("w-full rounded-full bg-muted-foreground/20", cfg.lines)} />
            <div className={cn("w-4/5 rounded-full bg-primary/25", cfg.lines)} />
            <div className={cn("w-1/2 rounded-full bg-muted-foreground/20", cfg.lines)} />
          </div>

          {/* Flipping Page Leaf 3 */}
          <div className="book-page-leaf leaf-3 absolute left-1/2 top-0 w-1/2 h-full bg-card/95 rounded-r-[3px] border-y border-r border-primary/30 p-1 flex flex-col justify-center overflow-hidden shadow-sm">
            <div className={cn("w-5/6 rounded-full bg-muted-foreground/20", cfg.lines)} />
            <div className={cn("w-full rounded-full bg-muted-foreground/20", cfg.lines)} />
            <div className={cn("w-3/5 rounded-full bg-primary/25", cfg.lines)} />
          </div>
        </div>

        {/* Soft Ambient Shadow Under Book */}
        <div
          className={cn(
            "book-loader-shadow mt-2 rounded-full bg-primary/20 blur-[2px]",
            cfg.shadow,
          )}
        />
      </div>

      {/* Label Text */}
      {text && (
        <div className="text-center">
          <p
            className={cn(
              "font-medium text-muted-foreground tracking-tight animate-pulse",
              cfg.text,
            )}
          >
            {text}
          </p>
          {subtitle && <p className="mt-0.5 text-xs text-muted-foreground/75">{subtitle}</p>}
        </div>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        {content}
      </div>
    );
  }

  return content;
}
