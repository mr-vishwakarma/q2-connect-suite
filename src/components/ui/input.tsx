import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-xl border border-[rgba(225,225,255,0.10)] bg-[#191B26]/90 px-3.5 py-2 text-base text-[#F0EFF8] ring-offset-[#090B12] transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-[#F0EFF8] placeholder:text-[#74788F] focus-visible:outline-none focus-visible:border-[#A78BFA]/60 focus-visible:ring-2 focus-visible:ring-[#A78BFA]/25 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
