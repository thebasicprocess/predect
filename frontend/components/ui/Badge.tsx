import { cn } from "@/lib/utils";

interface BadgeProps {
  variant?: "default" | "success" | "warning" | "danger" | "accent" | "muted";
  size?: "sm" | "md";
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function Badge({
  variant = "default",
  size = "sm",
  children,
  className,
  style,
}: BadgeProps) {
  const variants = {
    default: "bg-white/5 text-text-secondary border border-border",
    success: "bg-success/10 text-success border border-success/20",
    warning: "bg-warning/10 text-warning border border-warning/20",
    danger: "bg-danger/10 text-danger border border-danger/20",
    accent: "bg-accent/10 text-accent border border-accent/20",
    muted: "bg-white/3 text-text-muted border border-border",
  };
  const sizes = {
    sm: "text-xs px-2 py-0.5",
    md: "text-sm px-2.5 py-1",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-medium",
        variants[variant],
        sizes[size],
        className
      )}
      style={style}
    >
      {children}
    </span>
  );
}
