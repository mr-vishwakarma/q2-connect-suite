import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-[#171928]/95 group-[.toaster]:backdrop-blur-xl group-[.toaster]:text-[#F0EFF8] group-[.toaster]:border-[rgba(210,195,255,0.16)] group-[.toaster]:rounded-xl group-[.toaster]:shadow-xl",
          description: "group-[.toast]:text-[#9295AD]",
          actionButton: "group-[.toast]:bg-[#7C5CE6] group-[.toast]:text-white",
          cancelButton: "group-[.toast]:bg-[#202230] group-[.toast]:text-[#9295AD]",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
