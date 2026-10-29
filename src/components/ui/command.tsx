"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"

const CommandRoot = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("w-full", className)} {...props} />
))
CommandRoot.displayName = "CommandRoot"

interface CommandListProps extends React.HTMLAttributes<HTMLUListElement> {}

const CommandList = React.forwardRef<HTMLUListElement, CommandListProps>(
  ({ className, ...props }, ref) => (
    <ul
      ref={ref}
      className={cn(
        "max-h-[300px] min-w-[225px] overflow-y-auto overflow-x-hidden",
        className
      )}
      {...props}
    />
  )
)
CommandList.displayName = "CommandList"

interface CommandEmptyProps extends React.HTMLAttributes<HTMLDivElement> {}

const CommandEmpty = React.forwardRef<HTMLDivElement, CommandEmptyProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("py-6 text-center text-sm", className)}
      {...props}
    />
  )
)
CommandEmpty.displayName = "CommandEmpty"

interface CommandGroupProps extends React.HTMLAttributes<HTMLParagraphElement> {
  title?: string
}

const CommandGroup = React.forwardRef<
  HTMLParagraphElement,
  CommandGroupProps
>(({ className, title, ...props }, ref) => (
  <div className={cn("px-2 pb-2 pt-3 text-sm font-semibold", className)} {...props}>
    {title && <span>{title}</span>}
  </div>
))
CommandGroup.displayName = "CommandGroup"

interface CommandSeparatorProps extends React.HTMLAttributes<HTMLHRElement> {}

const CommandSeparator = React.forwardRef<HTMLHRElement, CommandSeparatorProps>(
  ({ className, ...props }, ref) => (
    <hr
      ref={ref}
      className={cn("mx-1 h-px bg-border", className)}
      {...props}
    />
  )
)
CommandSeparator.displayName = "CommandSeparator"

interface CommandItemProps extends React.ComponentPropsWithoutRef<"li"> {
  onSelect?: () => void
  disabled?: boolean
}

const CommandItem = React.forwardRef<
  HTMLLIElement,
  CommandItemProps
>(({ onSelect, disabled, className, ...props }, ref) => {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (disabled) return
    onSelect?.()
  }

  return (
    <li
      ref={ref}
      onClick={handleClick}
      className={cn(
        "relative flex cursor-pointer select-none items-center rounded-sm py-1.5 pl-2 pr-1 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        disabled && "data-[disabled]",
        className
      )}
      {...props}
    />
  )
})
CommandItem.displayName = "CommandItem"

interface CommandShortcutProps extends React.HTMLAttributes<HTMLSpanElement> {}

const CommandShortcut = React.forwardRef<
  HTMLSpanElement,
  CommandShortcutProps
>(({ className, ...props }, ref) => (
  <span
    ref={ref}
    className={cn(
      "ml-auto text-xs tracking-widest text-muted-foreground",
      className
    )}
    {...props}
  />
))
CommandShortcut.displayName = "CommandShortcut"

type CommandDialogItem = {
  id: string
  title: string
  hint?: string
  shortcut?: string
  icon?: React.ReactNode
  onSelect: () => void
  disabled?: boolean
  section?: string
  keywords?: string[]
  permission?: string
  globalIndex?: number
}

interface CommandDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  items: CommandDialogItem[]
  placeholder?: string
  noResultsMessage?: string
  loading?: boolean
}

const CommandDialog = React.forwardRef<HTMLDivElement, CommandDialogProps>(
  (
    {
      open,
      onOpenChange,
      items,
      placeholder = "Type a command or search...",
      noResultsMessage = "No results found.",
      loading,
      ...props
    },
    ref
  ) => {
    const inputRef = React.useRef<HTMLInputElement>(null)
    const [query, setQuery] = React.useState("")
    const [highlightedIndex, setHighlightedIndex] = React.useState(-1)

    // Assign global index to each item for consistent keyboard navigation
    const itemsWithGlobalIndex = React.useMemo(() => {
      return items.map((item, index) => ({ ...item, globalIndex: index }))
    }, [items])

    const filtered = React.useMemo(
      () =>
        itemsWithGlobalIndex.filter((item) => {
          if (!query.trim()) return true
          const q = query.toLowerCase()
          return (
            item.title.toLowerCase().includes(q) ||
            (item.hint?.toLowerCase().includes(q) ?? false) ||
            (item.keywords?.some((k) => k.toLowerCase().includes(q)) ?? false)
          )
        }),
      [itemsWithGlobalIndex, query]
    )

    React.useEffect(() => {
      setHighlightedIndex(-1)
    }, [query, items.length])

    React.useEffect(() => {
      if (open) setTimeout(() => inputRef.current?.focus(), 0)
    }, [open])

    const visibleItems = loading ? items : filtered
    const hasResults = visibleItems.length > 0

    // Group by section when present, preserving a flat fallback.
    const groupedItems = React.useMemo(() => {
      const map = new Map<string | null, CommandDialogItem[]>()
      visibleItems.forEach((item) => {
        const key = item.section ?? null
        const arr = map.get(key) ?? []
        arr.push(item)
        map.set(key, arr)
      })
      return Array.from(map.entries()).map(([section, items]) => ({
        section,
        items,
      }))
    }, [visibleItems])

    // Create a flat array of items with their global indices for keyboard navigation
    const flatVisibleItems = React.useMemo(() => {
      const flat: CommandDialogItem[] = []
      groupedItems.forEach((group) => {
        group.items.forEach((item) => flat.push(item))
      })
      return flat
    }, [groupedItems])

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        onOpenChange(false)
        return
      }
      if (e.key === "ArrowDown") {
        e.preventDefault()
        setHighlightedIndex((i) =>
          i >= flatVisibleItems.length - 1 ? i : i + 1
        )
        return
      }
      if (e.key === "ArrowUp") {
        e.preventDefault()
        setHighlightedIndex((i) => (i <= 0 ? 0 : i - 1))
        return
      }
      if (e.key === "Enter") {
        e.preventDefault()
        const active = flatVisibleItems[highlightedIndex]
        if (active && !active.disabled) {
          active.onSelect()
          onOpenChange(false)
        }
        return
      }
    }

    const handleItemSelect = (item: CommandDialogItem) => {
      if (item.disabled) return
      item.onSelect()
      onOpenChange(false)
    }

    return (
      <Dialog open={open} onOpenChange={onOpenChange} {...props}>
        <DialogContent className="p-0 sm:w-[520px]">
          <DialogHeader className="pb-2">
            <DialogTitle className="font-semibold">Commands</DialogTitle>
          </DialogHeader>
          <div className="flex items-center gap-2 px-4 py-2 border-b border-border">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-muted-foreground shrink-0"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <Input
              ref={inputRef}
              className="flex-1 bg-transparent p-0 text-sm"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={placeholder}
              onKeyDown={handleKeyDown}
            />
          </div>
          <div className="p-1">
            <CommandList role="listbox" aria-label="Commands">
              {loading || (!hasResults && query.trim()) ? (
                <CommandEmpty>
                  {loading ? "Loading commands..." : noResultsMessage}
                </CommandEmpty>
              ) : (
                <>
{groupedItems.map((group, gi) => (
                      <React.Fragment key={group.section ?? `ungrouped-${gi}`}>
                        {group.section && (
                          <CommandGroup title={group.section} />
                        )}
                        {group.items.map((item) => {
                          const highlighted = item.globalIndex === highlightedIndex
                          return (
                            <CommandItem
                              key={item.id}
                              onSelect={() => handleItemSelect(item)}
                              disabled={item.disabled}
                              role="option"
                              aria-selected={highlighted}
                              aria-disabled={item.disabled}
                              className={
                                highlighted
                                  ? "bg-accent text-accent-foreground"
                                  : undefined
                              }
                            >
                              <div className="flex h-7 w-7 items-center justify-center rounded-sm bg-accent text-accent-foreground shrink-0">
                                {item.icon ?? (
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="14"
                                    height="14"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  >
                                    <circle cx="12" cy="12" r="10" />
                                  </svg>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="truncate">{item.title}</div>
                                {item.hint && (
                                  <div className="truncate text-xs text-muted-foreground">
                                    {item.hint}
                                  </div>
                                )}
                              </div>
                              {item.shortcut && (
                                <CommandShortcut>{item.shortcut}</CommandShortcut>
                              )}
                            </CommandItem>
                          );
                        })}
                        {group.section &&
                          gi < groupedItems.length - 1 && (
                            <CommandSeparator />
                          )}
                      </React.Fragment>
                    ))}
                </>
              )}
            </CommandList>
          </div>
        </DialogContent>
      </Dialog>
    )
  }
)
CommandDialog.displayName = "CommandDialog"

export {
  CommandRoot,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandSeparator,
  CommandItem,
  CommandShortcut,
  CommandDialog,
}
