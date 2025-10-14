import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold ring-offset-background transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 relative overflow-hidden backdrop-blur-sm",
  {
    variants: {
      variant: {
        default: "bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg hover:shadow-xl hover:from-purple-700 hover:to-blue-700 hover:-translate-y-1 hover:scale-105 border border-white/20",
        destructive:
          "bg-gradient-to-r from-red-600 to-red-700 text-white shadow-lg hover:shadow-xl hover:from-red-700 hover:to-red-800 hover:-translate-y-1 hover:scale-105 border border-white/20",
        outline:
          "border border-purple-200/50 bg-white/80 backdrop-blur-md hover:bg-white/90 hover:border-purple-300 hover:-translate-y-1 hover:scale-105 hover:shadow-lg text-gray-700",
        secondary:
          "bg-gradient-to-r from-gray-100 to-gray-200 text-gray-800 shadow-md hover:shadow-lg hover:from-gray-200 hover:to-gray-300 hover:-translate-y-1 hover:scale-105 border border-white/30",
        ghost: "hover:bg-purple-50/80 hover:text-purple-700 hover:-translate-y-0.5 backdrop-blur-sm border border-transparent hover:border-purple-200/50",
        link: "text-purple-600 underline-offset-4 hover:underline hover:text-purple-700",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
