import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast rounded-md border group-[.toaster]:bg-card group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-xl dark:group-[.toaster]:shadow-black/30",
          success:
            "group-[.toaster]:border-emerald-500/30 group-[.toaster]:bg-emerald-50 group-[.toaster]:text-emerald-950 dark:group-[.toaster]:border-emerald-500/40 dark:group-[.toaster]:bg-[#10231b] dark:group-[.toaster]:text-emerald-100",
          error:
            "group-[.toaster]:border-red-500/30 group-[.toaster]:bg-red-50 group-[.toaster]:text-red-950 dark:group-[.toaster]:border-red-500/40 dark:group-[.toaster]:bg-[#2b1719] dark:group-[.toaster]:text-red-100",
          warning:
            "group-[.toaster]:border-amber-500/35 group-[.toaster]:bg-amber-50 group-[.toaster]:text-amber-950 dark:group-[.toaster]:border-amber-500/40 dark:group-[.toaster]:bg-[#2b2414] dark:group-[.toaster]:text-amber-100",
          info:
            "group-[.toaster]:border-sky-500/30 group-[.toaster]:bg-sky-50 group-[.toaster]:text-sky-950 dark:group-[.toaster]:border-sky-500/40 dark:group-[.toaster]:bg-[#142331] dark:group-[.toaster]:text-sky-100",
          description: "group-[.toast]:text-muted-foreground dark:group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground dark:group-[.toast]:bg-background",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
