import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      position="top-center"
      duration={1000}
      toastOptions={{
        classNames: {
          toast: "group toast !rounded-lg !shadow-lg !border-0 !px-4 !py-3",
          title: "!text-sm !font-medium",
          description: "!text-xs !opacity-90",
          success: "!bg-emerald-500 !text-white [&_[data-icon]]:!text-white",
          error: "!bg-red-500 !text-white [&_[data-icon]]:!text-white",
          info: "!bg-blue-500 !text-white [&_[data-icon]]:!text-white",
          warning: "!bg-amber-500 !text-white [&_[data-icon]]:!text-white",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
