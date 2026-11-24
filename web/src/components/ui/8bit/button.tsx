import { type VariantProps, cva } from "class-variance-authority"
import type { ButtonHTMLAttributes, Ref } from "react"

import { Button as ShadcnButton } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import "@/components/ui/8bit/styles/retro.css"

export const buttonVariants = cva("", {
  variants: {
    font: {
      normal: "",
      retro: "retro",
    },
    variant: {
      default: "bg-foreground",
      destructive: "bg-foreground",
      outline: "bg-foreground",
      secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
      ghost: "hover:bg-accent hover:text-accent-foreground",
      link: "text-primary underline-offset-4 hover:underline",
    },
    size: {
      default: "",
      sm: "",
      lg: "",
      icon: "",
    },
  },
  defaultVariants: {
    variant: "default",
    size: "default",
  },
})

// 이 콘솔의 공용 Button은 Base UI 기반이라 asChild(Radix Slot)를 뺐다.
export interface BitButtonProps
  extends
    ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  ref?: Ref<HTMLButtonElement>
}

interface ButtonDecorationsProps {
  size: BitButtonProps["size"]
  variant: BitButtonProps["variant"]
}

function ButtonDecorations({ size, variant }: ButtonDecorationsProps) {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none contents"
      data-slot="button-decorations"
    >
      {variant !== "ghost" && variant !== "link" && size !== "icon" && (
        <>
          {/* Pixelated border */}
          <span className="absolute -top-0.5 left-0.5 h-0.5 w-1/2 bg-foreground dark:bg-ring" />
          <span className="absolute -top-0.5 right-0.5 h-0.5 w-1/2 bg-foreground dark:bg-ring" />
          <span className="absolute -bottom-0.5 left-0.5 h-0.5 w-1/2 bg-foreground dark:bg-ring" />
          <span className="absolute right-0.5 -bottom-0.5 h-0.5 w-1/2 bg-foreground dark:bg-ring" />
          <span className="absolute top-0 left-0 size-0.5 bg-foreground dark:bg-ring" />
          <span className="absolute top-0 right-0 size-0.5 bg-foreground dark:bg-ring" />
          <span className="absolute bottom-0 left-0 size-0.5 bg-foreground dark:bg-ring" />
          <span className="absolute right-0 bottom-0 size-0.5 bg-foreground dark:bg-ring" />
          <span className="absolute top-0.5 -left-0.5 h-[calc(100%-4px)] w-0.5 bg-foreground dark:bg-ring" />
          <span className="absolute top-0.5 -right-0.5 h-[calc(100%-4px)] w-0.5 bg-foreground dark:bg-ring" />
          {variant !== "outline" && (
            <>
              {/* Top shadow */}
              <span className="absolute top-0 left-0 h-0.5 w-full bg-foreground/20" />
              <span className="absolute top-0.5 left-0 h-0.5 w-3 bg-foreground/20" />

              {/* Bottom shadow */}
              <span className="absolute bottom-0 left-0 h-0.5 w-full bg-foreground/20" />
              <span className="absolute right-0 bottom-0.5 h-0.5 w-3 bg-foreground/20" />
            </>
          )}
        </>
      )}

      {size === "icon" && (
        <>
          <span className="absolute top-0 left-0 h-[5px] w-full bg-foreground md:h-0.5 dark:bg-ring" />
          <span className="absolute bottom-0 h-[5px] w-full bg-foreground md:h-0.5 dark:bg-ring" />
          <span className="absolute top-0.5 -left-0.5 h-1/2 w-[5px] bg-foreground md:w-0.5 dark:bg-ring" />
          <span className="absolute bottom-0.5 -left-0.5 h-1/2 w-[5px] bg-foreground md:w-0.5 dark:bg-ring" />
          <span className="absolute top-0.5 -right-0.5 h-1/2 w-[5px] bg-foreground md:w-0.5 dark:bg-ring" />
          <span className="absolute -right-0.5 bottom-0.5 h-1/2 w-[5px] bg-foreground md:w-0.5 dark:bg-ring" />
        </>
      )}
    </span>
  )
}

function Button({
  children,
  className,
  font,
  size,
  variant,
  ...props
}: BitButtonProps) {
  const decorations = <ButtonDecorations size={size} variant={variant} />

  return (
    <ShadcnButton
      {...props}
      className={cn(
        "relative inline-flex items-center justify-center gap-1.5 rounded-none border-none transition-transform active:translate-y-1",
        size === "icon" && "mx-0.5 my-0",
        font !== "normal" && "retro",
        className
      )}
      size={size}
      variant={variant}
    >
      {children}
      {decorations}
    </ShadcnButton>
  )
}

export { Button }
