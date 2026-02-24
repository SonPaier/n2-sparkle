

## Plan: White drawer background + visible input borders

### Problem
- The drawer (Sheet) background uses `bg-background` which is light blue/gray (`209 40% 96%`)
- Inputs have `border-input` but `--input` is set to `0 0% 100%` (white), making borders invisible against white input backgrounds

### Changes

**1. `src/index.css` — Update CSS variables**
- Change `--input` from `0 0% 100%` (white) to `212 26% 83%` (same as `--border`) so all inputs globally get visible borders
- This is the simplest global fix — every Input, Textarea, Select trigger will automatically show borders

**2. `src/components/ui/sheet.tsx` — White drawer background**
- Change the base class in `sheetVariants` from `bg-background` to `bg-white` (or `bg-card` which is white `0 0% 100%`)
- Using `bg-card` is better for dark mode compatibility

### Technical Details

CSS variable change in `:root`:
```
--input: 0 0% 100%;    →    --input: 212 26% 83%;
```

Sheet variant base class change:
```
"fixed z-50 gap-4 bg-background p-6 ..."  →  "fixed z-50 gap-4 bg-card p-6 ..."
```

This approach ensures:
- All inputs across the app get visible borders (global fix)
- All Sheet/drawer panels render with white background
- Dark mode continues to work via the `.dark` overrides (dark `--input` is already `215 19% 34%` which is visible)

