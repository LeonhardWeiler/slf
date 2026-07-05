import * as React from "react";
import { cn } from "@/lib/utils";

// Base UI has no standalone Label primitive (it only ships Field.Label bound to a
// Field context). For our plain form fields a native <label> with htmlFor is the
// idiomatic Base-UI-aligned replacement for the former Radix label.
const Label = React.forwardRef<
  HTMLLabelElement,
  React.LabelHTMLAttributes<HTMLLabelElement>
>(({ className, ...props }, ref) => (
  // biome-ignore lint/a11y/noLabelWithoutControl: reusable primitive — callers associate it with a control via the spread htmlFor prop.
  <label
    ref={ref}
    className={cn(
      "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
      className
    )}
    {...props}
  />
));
Label.displayName = "Label";

export { Label };
