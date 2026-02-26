import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

const LightTabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn("flex border-b border-border/50", className)}
    {...props}
  />
));
LightTabsList.displayName = "LightTabsList";

const LightTabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "flex-1 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
      "border-transparent text-muted-foreground hover:text-foreground",
      "data-[state=active]:border-primary data-[state=active]:text-primary",
      className
    )}
    {...props}
  />
));
LightTabsTrigger.displayName = "LightTabsTrigger";

export { LightTabsList, LightTabsTrigger };
