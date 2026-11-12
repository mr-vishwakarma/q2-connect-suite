import * as React from "react";

import { cn } from "@/lib/utils";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[84px] w-full rounded-xl border border-[rgba(225,225,255,0.10)] bg-[#191B26]/90 px-3.5 py-2.5 text-sm text-[#F0EFF8] ring-offset-[#090B12] transition-colors placeholder:text-[#74788F] focus-visible:outline-none focus-visible:border-[#A78BFA]/60 focus-visible:ring-2 focus-visible:ring-[#A78BFA]/25 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
