import { cn } from "@/lib/utils";
import {
  InputHTMLAttributes,
  TextareaHTMLAttributes,
  forwardRef,
} from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className, ...props }, ref) => (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-xs font-medium text-text-secondary">{label}</label>
      )}
      <input
        ref={ref}
        className={cn(
          "w-full bg-bg-card border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted",
          "focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30",
          "transition-all duration-200",
          error && "border-danger focus:border-danger focus:ring-danger/30",
          className
        )}
        {...props}
      />
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  )
);
Input.displayName = "Input";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, className, ...props }, ref) => (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-xs font-medium text-text-secondary">{label}</label>
      )}
      <textarea
        ref={ref}
        className={cn(
          "w-full bg-bg-card border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted",
          "focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30",
          "transition-all duration-200 resize-none",
          className
        )}
        {...props}
      />
    </div>
  )
);
Textarea.displayName = "Textarea";
