import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

const variants = {
  primary:   "bg-primary-600 text-white hover:bg-primary-700 border border-transparent",
  secondary: "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:border-slate-300",
  ghost:     "bg-transparent text-slate-600 border border-transparent hover:bg-slate-100",
  danger:    "bg-transparent text-red-600 border border-transparent hover:bg-red-50 hover:text-red-700",
  outline:   "bg-primary-50 text-primary-700 border border-primary-200 hover:bg-primary-100",
} as const;

const sizes = {
  sm: "h-7  px-3 text-xs  rounded-lg  gap-1.5",
  md: "h-9  px-4 text-sm  rounded-lg  gap-2",
  lg: "h-11 px-6 text-base rounded-xl gap-2.5",
} as const;

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
}

export default function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center font-medium transition",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1",
        "disabled:opacity-50 disabled:pointer-events-none",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
