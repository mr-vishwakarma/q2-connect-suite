import { cva } from "class-variance-authority";

export const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[#A78BFA]/60 focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-[#A78BFA]/30 bg-[#A78BFA]/15 text-[#D8CCFF] hover:bg-[#A78BFA]/22",
        secondary: "border-white/[0.08] bg-[#202230] text-[#9295AD] hover:bg-[#292B3B] hover:text-[#F0EFF8]",
        destructive: "border-rose-500/25 bg-rose-500/12 text-rose-300 hover:bg-rose-500/20",
        outline: "border-[rgba(225,225,255,0.12)] bg-transparent text-[#F0EFF8]",
        success: "border-emerald-500/25 bg-emerald-500/12 text-emerald-300",
        warning: "border-amber-500/25 bg-amber-500/12 text-amber-300",
        info: "border-sky-500/25 bg-sky-500/12 text-sky-300",
        mint: "border-[#74DCCB]/25 bg-[#74DCCB]/12 text-[#74DCCB]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);
