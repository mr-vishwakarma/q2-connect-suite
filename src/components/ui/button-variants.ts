import { cva } from "class-variance-authority";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A78BFA]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#090B12] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default:
          "bg-[#7C5CE6] text-[#F8F7FF] border border-white/15 hover:bg-[#8A6CF2] shadow-[0_6px_20px_-6px_rgba(124,92,230,0.55)] hover:shadow-[0_8px_24px_-4px_rgba(167,139,250,0.55)]",
        destructive:
          "bg-rose-500/90 text-white border border-rose-400/25 hover:bg-rose-500 shadow-[0_4px_16px_-4px_rgba(244,63,94,0.4)]",
        outline:
          "border border-[rgba(225,225,255,0.11)] bg-white/[0.025] text-[#F0EFF8] hover:bg-white/[0.06] hover:border-[rgba(210,195,255,0.24)]",
        secondary:
          "bg-[#1E2130] text-[#F0EFF8] border border-white/[0.07] hover:bg-[#272B3E] hover:border-white/[0.14]",
        ghost:
          "text-[#9295AD] hover:bg-white/[0.05] hover:text-[#F0EFF8]",
        link: "text-[#A78BFA] underline-offset-4 hover:underline hover:text-[#C4B5FD]",
        hero:
          "bg-gradient-to-r from-[#7C5CE6] via-[#9370F8] to-[#D97EB0] text-white border border-white/20 shadow-[0_8px_24px_-4px_rgba(167,139,250,0.45)] hover:brightness-110",
        glass:
          "bg-white/[0.045] backdrop-blur-md border border-[rgba(225,225,255,0.10)] text-[#F0EFF8] hover:bg-white/[0.085] hover:border-[rgba(210,195,255,0.24)]",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-lg px-3 text-xs",
        lg: "h-11 rounded-xl px-7",
        xl: "h-12 rounded-xl px-8 text-base",
        icon: "h-10 w-10 rounded-xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);
