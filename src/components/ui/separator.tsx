import * as React from "react"
import { Root as SeparatorPrimitive } from "@radix-ui/react-separator"

import { cn } from "@/lib/utils"

const Separator = React.forwardRef<
  React.ElementRef<typeof SeparatorPrimitive>,
  React.ComponentPropsWithoutRef<typeof SeparatorPrimitive>
>((props, ref) => {
  return (
    <SeparatorPrimitive
      ref={ref}
      className={cn(
        "shrink-0 border border-border",
        props.className,
        props.decorative && "data-[slot=separator]"
      )}
      {...props}
    />
  )
})
Separator.displayName = SeparatorPrimitive.displayName

export { Separator }
