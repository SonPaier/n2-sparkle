
## Plan: Apply N2Wash autocomplete style to customer and address search

### What changes

N2Wash uses a simple `Input`-based autocomplete with a dropdown `div` instead of the `Popover + Command` pattern. The style features:
- Plain `Input` field (no popover trigger button)
- Absolute-positioned dropdown with `bg-card`, `shadow-lg`, `rounded-lg`, `z-[9999]`
- Each result is a `button` with `p-4`, `border-b`, keyboard navigation support
- Customer name in `font-semibold text-base text-foreground`
- Phone in `text-primary font-medium` with formatting
- Hover state: `hover:bg-muted/30`, selected: `bg-accent`
- Loader spinner in the input field

### Files to change

**1. `src/components/admin/CustomerSearchInput.tsx`** -- Full rewrite of the dropdown portion
- Replace `Popover + Command` with a plain `Input` + absolute dropdown `div`
- Keep existing selected-customer display (with X button and click-to-open)
- Add keyboard navigation (ArrowUp/Down, Enter, Escape)
- Style results: `p-4`, `font-semibold text-base`, phone in `text-primary font-medium`
- Dropdown: `bg-card shadow-lg rounded-lg z-[9999] border border-border`
- Show `Loader2` spinner inside input while searching
- Close on outside click via `useRef` + `mousedown` listener

**2. `src/components/admin/AddressSearchInput.tsx`** -- Same pattern
- Replace `Popover + Command` with `Input` + absolute dropdown
- Keep the display value logic (showing selected address in the input)
- Style results identically: `p-4`, `font-medium text-base` for street, `text-sm text-muted-foreground` for city/postal
- Add keyboard navigation
- Dropdown: same `bg-card shadow-lg rounded-lg z-[9999]` styling
- Loader spinner in input

### Technical details

Both components switch from the `cmdk` Command pattern to a simpler native approach:

```text
Before:                          After:
Popover                          div (relative)
  PopoverTrigger (Button)          Input (always visible)
  PopoverContent                   Loader2 (absolute, in input)
    Command                        div (absolute dropdown)
      CommandInput                   button (per result)
      CommandList                      name (semibold)
        CommandItem                    phone/address (primary)
```

Key styling from N2Wash to replicate:
- Dropdown: `absolute top-full left-0 right-0 mt-1 border border-border rounded-lg overflow-hidden bg-card shadow-lg z-[9999]`
- Result button: `w-full p-4 text-left transition-colors flex flex-col border-b border-border last:border-0`
- Hover/selected: `hover:bg-muted/30` / `bg-accent`
- Phone formatting: strip `+48`, add spaces every 3 digits, `text-primary font-medium`
