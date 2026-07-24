import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  // Brutalist base (rebrand batch 1): hard ink border + hard offset shadow, hover
  // lifts the shadow, active presses into it. Coral originals archived at tag
  // `backup-coral-glass`.
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-bold border-2 border-[#141414] shadow-[4px_4px_0_#141414] ring-offset-background transition-[transform,box-shadow,background-color] duration-150 hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-[6px_6px_0_#141414] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // Primary action — brand yellow, ink text.
        default: "bg-[#fed50a] text-[#141414]",
        destructive: "bg-[#141414] text-white",
        outline: "bg-white text-[#141414]",
        secondary: "bg-white text-[#141414]",
        ghost: "border-transparent shadow-none hover:bg-[#fed50a]/25 hover:translate-x-0 hover:translate-y-0 hover:shadow-none active:translate-x-0 active:translate-y-0",
        link: "border-transparent shadow-none text-[#141414] underline-offset-4 hover:underline hover:translate-x-0 hover:translate-y-0 hover:shadow-none active:translate-x-0 active:translate-y-0",
        accent: "bg-[#fed50a] text-[#141414]",
        "accent-outline": "bg-white text-[#141414]",
        premium: "bg-[#fed50a] text-[#141414]",
        "premium-outline": "bg-white text-[#141414]",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "h-9 px-4 text-xs",
        lg: "h-12 px-8 text-base",
        xl: "h-14 px-10 text-base font-semibold",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
