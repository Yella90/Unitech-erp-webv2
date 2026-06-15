# Frontend Design System - Quick Reference Guide

## Color Palette Quick Reference

```
PRIMARY ACTION
├── indigo-600         #4f46e5  (buttons, focus rings, primary action)
├── indigo-700         #4338ca  (hover state)
├── indigo-50/60       (soft background for metrics)
└── indigo-500         (focus ring color)

NEUTRAL BASE (Slate)
├── slate-900          #0f172a  (primary text)
├── slate-800          #1e293b  (secondary text)
├── slate-700          #334155  (form labels, tertiary text)
├── slate-600          #475569  (hints, secondary labels)
├── slate-500          #64748b  (light text, placeholders)
├── slate-400          #cbd5e1  (disabled state)
├── slate-200          #e2e8f0  (borders, dividers)
├── slate-100          #f1f5f9  (subtle backgrounds)
└── slate-50           #f8fafc  (table headers, very light)

STATUS COLORS
Success    ├── emerald-600 #059669  ├── text-emerald-600
           └── bg-emerald-50/60
Error      ├── rose-600    #e11d48  ├── text-rose-600
           └── bg-rose-50
Warning    ├── amber-600   #d97706  ├── text-amber-600
           └── bg-amber-50/60
Info       ├── sky-600     #0284c7  ├── text-sky-600
           └── bg-sky-50/60
```

## Typography System

```
Page Heading:       text-lg font-semibold text-slate-900      (18px)
Section Heading:    text-base font-semibold text-slate-900    (16px)
Subsection:         text-sm font-semibold text-slate-700      (14px)
Body Text:          text-sm text-slate-700                    (14px)
Form Label:         text-sm font-medium text-slate-700        (14px)
Small Text:         text-xs text-slate-600                    (12px)
Tiny Text:          text-[10px] text-slate-500                (10px)
Error Message:      text-xs text-red-600 font-medium          (12px, bold)
Hint Text:          text-xs text-slate-500                    (12px, light)
```

## Component Quick Reference

### Standard Card Container
```jsx
// Used for: Metrics, forms, panels, lists
className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"

// With subtle background variant
className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-5 shadow-sm"
```

### Button Styles
```jsx
// Primary Button
className="rounded-md bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700"

// Secondary Button
className="rounded-md bg-slate-100 px-4 py-2 text-slate-700 hover:bg-slate-200"

// Danger Button
className="rounded-md bg-rose-600 px-4 py-2 text-white hover:bg-rose-700"

// Small Button (table actions)
className="rounded-md bg-rose-600 px-3 py-1 text-xs text-white"
```

### Form Input
```jsx
<label className="mb-1 block text-sm font-medium text-slate-700">
  Label Text
  <span className="text-red-600 ml-1">*</span>
</label>
<input
  className="w-full rounded-md border border-slate-300 px-3 py-2
             focus:outline-none focus:ring-2 focus:ring-indigo-500"
/>
{error && <p className="mt-1 text-xs text-red-600 font-medium">{error}</p>}
```

### Metric Card
```jsx
{
  label: "Total Students",
  value: "245",
  hint: "Currently enrolled",
  icon: UserIcon,
  color: "text-indigo-600",
  tone: "bg-indigo-50/60"
}
```

### Table Header
```jsx
<thead className="bg-slate-50 text-slate-600">
  <tr className="border-b border-slate-200">
    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">
      Column Name
    </th>
  </tr>
</thead>
```

## Responsive Grid Patterns

```jsx
// 1 col mobile → 2 cols sm → 3 cols md → 4 cols lg
className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"

// 1 col mobile → 2 cols sm → 3 cols lg (common for metrics)
className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"

// 1 col mobile → 2 cols lg (form + table side-by-side)
className="grid gap-4 lg:grid-cols-[1fr_1.4fr]"

// Hidden states
className="hidden lg:inline"      // Hidden on mobile, visible on lg+
className="lg:hidden"             // Visible on mobile, hidden on lg+
```

## Spacing System

```
Vertical Spacing
├── space-y-2    (gap 8px)
├── space-y-3    (gap 12px)
├── space-y-4    (gap 16px)
├── space-y-5    (gap 20px)
└── space-y-6    (gap 24px)

Grid Gap
├── gap-2    (8px)
├── gap-3    (12px)
├── gap-4    (16px)  ← Most common
└── gap-5    (20px)

Padding
├── p-3      (12px) - Mobile content padding
└── p-4      (16px) - Desktop content padding

Sections
├── p-5      (20px) - Card/panel internal padding
└── p-6      (24px) - Form section padding
```

## Animation Classes

```
Entrance Animations
├── animate-fadeInUp        (400ms: fade + slide up)
├── animate-fadeInDown      (400ms: fade + slide down)
├── animate-fadeInScale     (500ms: fade + scale)
└── animate-fadeInCascade   (500ms: cascade with delay)

Error Feedback
├── animate-shake           (500ms: ±2px oscillation)
└── animate-shakeWarn       (600ms: ±3px oscillation)

Loading Indicators
├── animate-spin            (1s: rotation)
├── animate-spinBounce      (1.5s: rotation + scale)
├── animate-bounce          (1s: vertical bounce)
└── animate-pulse           (2s: opacity pulse)

Cascade (for lists)
├── animate-cascade-1       (0ms delay)
├── animate-cascade-2       (50ms delay)
├── animate-cascade-3       (100ms delay)
├── animate-cascade-4       (150ms delay)
├── animate-cascade-5       (200ms delay)
└── animate-cascade-6       (250ms delay)
```

## Common Class Combinations

### Page Loading State
```jsx
className="min-h-[320px] rounded-2xl border border-slate-200 bg-gradient-to-br 
           from-white via-slate-50 to-indigo-50/60 p-8 shadow-sm"
```

### Metric Card Container
```jsx
className="rounded-xl p-5 shadow-sm ring-1 ring-slate-200 bg-white"
```

### Success Banner
```jsx
className="rounded-lg border border-emerald-200 bg-emerald-50 p-4"
```

### Error Banner
```jsx
className="rounded-lg border border-rose-200 bg-rose-50 p-4"
```

### Table Cell (Data)
```jsx
className="px-4 py-3 text-slate-700"
```

### Table Cell (Header)
```jsx
className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide"
```

## Responsive Text Classes

```jsx
// Different sizes on mobile vs desktop
className="text-sm sm:text-base"

// Full width on mobile, auto on desktop
className="w-full sm:w-auto"

// Hidden on mobile, visible on lg+
className="hidden lg:inline"

// Gap adjustment for different screen sizes
className="gap-2 sm:gap-3 lg:gap-4"

// Padding adjustment
className="p-3 sm:p-4"
```

## Focus/Accessibility Classes

```jsx
// Standard focus ring (all interactive elements)
focus:outline-none focus:ring-2 focus:ring-indigo-500

// Error state ring
focus:ring-red-500

// Disabled state
disabled:opacity-50
disabled:cursor-not-allowed
disabled:bg-gray-400
```

## Component Usage Matrix

| Component | Pages | Pattern |
|-----------|-------|---------|
| MetricCard | Dashboard, Finances | Icon + label + value + hint |
| Card | Finances, Salaires | Title + value (financial) |
| FormInput | Classes, Finances | Label + input + error + shake |
| SearchableSelect | Salaires | Searchable dropdown with filtering |
| RippleButton | All action buttons | Material Design ripple effect |
| Table | ElevesListe, Classes, Salaires | thead + tbody with hover state |
| PageLoadingState | All pages | Spinner + message loading indicator |
| PageBanner | All pages | Toast notification for success/error |
| GroupedBarChart | Dashboard | Grouped column chart |
| LineAreaChart | Dashboard | Line with area fill chart |
| DoughnutChart | Dashboard | Conic gradient donut chart |

## Accessibility Checklist

- [ ] Form inputs have associated labels
- [ ] Required fields marked with asterisk (*)
- [ ] Error messages marked with `role="alert"`
- [ ] Icon-only buttons have `aria-label`
- [ ] Focus rings visible on interactive elements
- [ ] Tables have proper thead/tbody structure
- [ ] Tables have `<caption>` elements
- [ ] Color contrast tested (WCAG AA minimum)
- [ ] Keyboard navigation works for custom components
- [ ] Error summary region at form top (if multi-field)

## Performance Considerations

- **Cascade animations**: Use sparingly (max 6-8 items)
- **SVG charts**: Render efficiently with direct path rendering
- **Table rendering**: Consider virtualization for 100+ rows
- **SearchableSelect**: Add debouncing for large lists
- **Form validation**: Avoid excessive re-renders on input change

## Common Patterns by Page Type

### Dashboard Page
1. Metric cards in grid (cascade animations)
2. Filter/period controls
3. Charts below metrics
4. Summary statistics

### Data Management Page
1. Form section (left)
2. Data table (right)
3. PageBanner for notifications
4. CRUD action buttons

### Administrative Page
1. Stats overview cards
2. Search/filter controls
3. Data list/table
4. Bulk action controls

---

*Quick Reference v1.0*  
*Last Updated: June 2, 2026*
