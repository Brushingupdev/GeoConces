import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}

export default function Input({ className, ...props }: InputProps) {
  return (
    <input
      className={cn(
        "w-full px-4 py-2 border border-slate-200 rounded-lg text-sm bg-white",
        "placeholder:text-slate-400",
        "focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent",
        "disabled:opacity-50 disabled:bg-slate-50",
        className,
      )}
      {...props}
    />
  );
}
