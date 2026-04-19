import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // ── shadcn originals ────────────────────────────────────────────
        default:     "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:     "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary:   "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost:       "hover:bg-accent hover:text-accent-foreground",
        link:        "text-primary underline-offset-4 hover:underline",

        // ── brand variants ──────────────────────────────────────────────
        dark: cn(
          "h-auto gap-1.5 border-0 font-sans cursor-pointer select-none",
          "px-[17px] py-[9px] rounded-full text-[13px] font-semibold text-white",
          "bg-[linear-gradient(180deg,#22272E_0%,#0D1117_100%)]",
          "shadow-[inset_0_1px_0_rgba(255,255,255,.12),inset_0_-1px_0_rgba(0,0,0,.4),0_2px_0_#000,0_4px_0_rgba(0,0,0,.25),0_8px_14px_-4px_rgba(15,23,42,.35)]",
          "transition-[transform,box-shadow,filter] duration-[120ms] ease-[cubic-bezier(.2,.8,.2,1)]",
          "hover:-translate-y-px hover:brightness-[1.08]",
          "hover:shadow-[inset_0_1px_0_rgba(255,255,255,.16),inset_0_-1px_0_rgba(0,0,0,.45),0_3px_0_#000,0_6px_0_rgba(0,0,0,.22),0_12px_20px_-4px_rgba(15,23,42,.4)]",
          "active:translate-y-[3px] active:shadow-[inset_0_2px_6px_rgba(0,0,0,.6),inset_0_1px_0_rgba(255,255,255,.06)]",
        ),

        primary: cn(
          "h-auto gap-1.5 border-0 font-sans cursor-pointer select-none",
          "px-[18px] py-[9px] rounded-full text-[13px] font-semibold text-white",
          "bg-[linear-gradient(180deg,#3B82F6_0%,#2563EB_100%)]",
          "shadow-[inset_0_1px_0_rgba(255,255,255,.35),inset_0_-1px_0_rgba(23,58,157,.5),0_2px_0_#1E40AF,0_4px_0_rgba(30,64,175,.3),0_8px_14px_-4px_rgba(37,99,235,.45)]",
          "transition-[transform,box-shadow,filter] duration-[120ms] ease-[cubic-bezier(.2,.8,.2,1)]",
          "hover:-translate-y-px hover:brightness-[1.06]",
          "hover:shadow-[inset_0_1px_0_rgba(255,255,255,.4),inset_0_-1px_0_rgba(23,58,157,.55),0_3px_0_#1E40AF,0_6px_0_rgba(30,64,175,.28),0_12px_20px_-4px_rgba(37,99,235,.5)]",
          "active:translate-y-[3px] active:shadow-[inset_0_2px_6px_rgba(23,58,157,.6),inset_0_1px_0_rgba(255,255,255,.12)]",
        ),

        "brand-ghost": cn(
          "h-auto gap-1.5 border-0 font-sans cursor-pointer select-none",
          "px-[17px] py-[9px] rounded-full text-[13px] font-medium text-gray-700 bg-white",
          "shadow-[inset_0_1px_0_#fff,inset_0_0_0_1px_#E5E7EB,0_1px_0_#D1D5DB,0_2px_0_rgba(209,213,219,.4),0_4px_8px_-2px_rgba(15,23,42,.08)]",
          "transition-[transform,box-shadow,filter] duration-[120ms] ease-[cubic-bezier(.2,.8,.2,1)]",
          "hover:-translate-y-px hover:text-gray-900",
          "hover:shadow-[inset_0_1px_0_#fff,inset_0_0_0_1px_#D1D5DB,0_2px_0_#D1D5DB,0_4px_0_rgba(209,213,219,.35),0_8px_14px_-3px_rgba(15,23,42,.12)]",
          "active:translate-y-[2px] active:shadow-[inset_0_2px_4px_rgba(15,23,42,.12),inset_0_0_0_1px_#D1D5DB]",
        ),

        cta: cn(
          "h-auto w-full gap-1.5 border-0 font-sans cursor-pointer select-none",
          "px-[22px] py-[15px] rounded-[14px] text-[13.5px] font-bold text-white tracking-[-.005em]",
          "bg-[linear-gradient(180deg,#3B82F6_0%,#2563EB_100%)]",
          "shadow-[inset_0_1px_0_rgba(255,255,255,.4),inset_0_-2px_0_rgba(23,58,157,.5),0_3px_0_#1E40AF,0_6px_0_rgba(30,64,175,.3),0_14px_24px_-6px_rgba(37,99,235,.5)]",
          "transition-[transform,box-shadow,filter] duration-[120ms] ease-[cubic-bezier(.2,.8,.2,1)]",
          "hover:-translate-y-0.5 hover:brightness-[1.05]",
          "hover:shadow-[inset_0_1px_0_rgba(255,255,255,.45),inset_0_-2px_0_rgba(23,58,157,.55),0_5px_0_#1E40AF,0_9px_0_rgba(30,64,175,.28),0_18px_28px_-6px_rgba(37,99,235,.55)]",
          "active:translate-y-1 active:shadow-[inset_0_3px_8px_rgba(23,58,157,.6),inset_0_1px_0_rgba(255,255,255,.12)]",
          "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:brightness-100",
        ),

        "chip-yes": cn(
          "h-auto gap-1.5 border-0 font-sans cursor-pointer select-none",
          "px-3 py-[7px] rounded-[9px] text-[10.5px] font-bold text-emerald-700",
          "bg-[linear-gradient(180deg,#ECFDF5_0%,#D1FAE5_100%)]",
          "shadow-[inset_0_1px_0_rgba(255,255,255,.9),inset_0_0_0_1px_rgba(16,185,129,.35),0_1px_0_rgba(16,185,129,.35),0_2px_0_rgba(16,185,129,.15),0_3px_6px_-1px_rgba(16,185,129,.2)]",
          "transition-[transform,box-shadow] duration-[120ms] ease-[cubic-bezier(.2,.8,.2,1)]",
          "hover:-translate-y-px hover:shadow-[inset_0_1px_0_#fff,inset_0_0_0_1px_rgba(16,185,129,.45),0_2px_0_rgba(16,185,129,.4),0_6px_10px_-2px_rgba(16,185,129,.3)]",
          "active:translate-y-[2px] active:shadow-[inset_0_2px_4px_rgba(16,185,129,.3),inset_0_0_0_1px_rgba(16,185,129,.5)]",
        ),

        "chip-no": cn(
          "h-auto gap-1.5 border-0 font-sans cursor-pointer select-none",
          "px-3 py-[7px] rounded-[9px] text-[10.5px] font-bold text-rose-700",
          "bg-[linear-gradient(180deg,#FFF1F2_0%,#FFE4E6_100%)]",
          "shadow-[inset_0_1px_0_rgba(255,255,255,.9),inset_0_0_0_1px_rgba(244,63,94,.35),0_1px_0_rgba(244,63,94,.35),0_2px_0_rgba(244,63,94,.15),0_3px_6px_-1px_rgba(244,63,94,.2)]",
          "transition-[transform,box-shadow] duration-[120ms] ease-[cubic-bezier(.2,.8,.2,1)]",
          "hover:-translate-y-px hover:shadow-[inset_0_1px_0_#fff,inset_0_0_0_1px_rgba(244,63,94,.45),0_2px_0_rgba(244,63,94,.4),0_6px_10px_-2px_rgba(244,63,94,.3)]",
          "active:translate-y-[2px] active:shadow-[inset_0_2px_4px_rgba(244,63,94,.3),inset_0_0_0_1px_rgba(244,63,94,.5)]",
        ),

        quick: cn(
          "h-auto gap-1.5 border-0 font-sans cursor-pointer select-none",
          "px-3.5 py-[7px] rounded-[9px] text-[11.5px] font-semibold text-gray-900",
          "bg-[linear-gradient(180deg,#F9FAFB_0%,#F3F4F6_100%)]",
          "shadow-[inset_0_1px_0_rgba(255,255,255,.9),inset_0_0_0_1px_#E5E7EB,0_1px_0_#D1D5DB,0_2px_0_rgba(209,213,219,.35),0_3px_6px_-1px_rgba(15,23,42,.08)]",
          "transition-[transform,box-shadow] duration-[120ms] ease-[cubic-bezier(.2,.8,.2,1)]",
          "hover:-translate-y-px hover:shadow-[inset_0_1px_0_#fff,inset_0_0_0_1px_#D1D5DB,0_2px_0_#D1D5DB,0_4px_0_rgba(209,213,219,.3),0_6px_10px_-2px_rgba(15,23,42,.1)]",
          "active:translate-y-[2px] active:shadow-[inset_0_2px_4px_rgba(15,23,42,.1),inset_0_0_0_1px_#D1D5DB]",
        ),
      },
      size: {
        default: "h-10 px-4 py-2",
        sm:      "h-9 rounded-md px-3",
        lg:      "h-11 rounded-md px-8",
        icon:    "h-10 w-10",
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

    // Brand variants have their own sizing — skip the default size
    const brandVariants = ["dark", "primary", "brand-ghost", "cta", "chip-yes", "chip-no", "quick"];
    const resolvedSize = variant && brandVariants.includes(variant) ? null : size;

    return (
      <Comp
        className={cn(buttonVariants({ variant, size: resolvedSize, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
