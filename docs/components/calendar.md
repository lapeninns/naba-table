# Calendar Component Documentation

The calendar component has been migrated from React Day Picker to **Cally**, a lightweight web component calendar library with full daisyUI styling support.

## Features

- ✅ **Web Component**: Works everywhere, framework-agnostic
- ✅ **Lightweight**: Smaller bundle size compared to React Day Picker
- ✅ **daisyUI Styled**: Automatically styled by daisyUI
- ✅ **Backward Compatible**: Maintains React Day Picker API for existing code
- ✅ **Accessible**: Full keyboard support and ARIA attributes

## Installation

Cally is already installed in the project:

```bash
pnpm add cally
```

## Basic Usage

### Simple Calendar

```tsx
import { Calendar } from '@/components/ui/calendar';

export function MyComponent() {
  const [date, setDate] = useState<Date>();

  return <Calendar mode="single" selected={date} onSelect={setDate} />;
}
```

### Calendar with Date Picker (with Popover)

```tsx
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';

export function DatePicker() {
  const [date, setDate] = useState<Date>();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline">{date ? date.toLocaleDateString() : 'Pick a date'}</Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <Calendar mode="single" selected={date} onSelect={setDate} />
      </PopoverContent>
    </Popover>
  );
}
```

## Props

### Calendar Props

| Prop              | Type                                | Default    | Description                                    |
| ----------------- | ----------------------------------- | ---------- | ---------------------------------------------- |
| `value`           | `string`                            | -          | ISO date string (YYYY-MM-DD) for Cally         |
| `selected`        | `Date`                              | -          | Selected date (React Day Picker compatibility) |
| `onSelect`        | `(date: Date \| undefined) => void` | -          | Callback when date is selected                 |
| `onValueChange`   | `(value: string) => void`           | -          | Callback with ISO string value                 |
| `min`             | `string`                            | -          | Minimum selectable date (ISO format)           |
| `max`             | `string`                            | -          | Maximum selectable date (ISO format)           |
| `disabled`        | `(date: Date) => boolean \| Date`   | -          | Function to disable specific dates             |
| `mode`            | `'single' \| 'multiple' \| 'range'` | `'single'` | Selection mode                                 |
| `showOutsideDays` | `boolean`                           | `true`     | Show days from adjacent months                 |
| `isoWeek`         | `boolean`                           | -          | Use ISO week numbering                         |
| `locale`          | `string`                            | -          | Locale for date formatting                     |
| `firstDayOfWeek`  | `number`                            | -          | First day of week (0 = Sunday)                 |
| `className`       | `string`                            | -          | Additional CSS classes                         |

## Examples

### Disable Past Dates

```tsx
<Calendar mode="single" selected={date} onSelect={setDate} disabled={(date) => date < new Date()} />
```

### With Min/Max Dates

```tsx
<Calendar mode="single" selected={date} onSelect={setDate} min="2024-01-01" max="2024-12-31" />
```

### Custom Styling

```tsx
<Calendar
  mode="single"
  selected={date}
  onSelect={setDate}
  className="border-2 border-primary rounded-lg shadow-xl"
/>
```

## Migration from React Day Picker

The Calendar component maintains backward compatibility with React Day Picker's API:

### Before (React Day Picker)

```tsx
import { Calendar } from '@/components/ui/calendar';

<Calendar mode="single" selected={date} onSelect={setDate} disabled={(day) => day < new Date()} />;
```

### After (Cally - same code works!)

```tsx
import { Calendar } from '@/components/ui/calendar';

<Calendar mode="single" selected={date} onSelect={setDate} disabled={(day) => day < new Date()} />;
```

No changes needed! The component automatically converts between React Day Picker's Date-based API and Cally's ISO string-based API.

## How It Works

The Calendar component:

1. **Auto-imports Cally**: Dynamically loads the Cally web component on mount
2. **Converts Props**: Transforms `Date` objects to ISO strings for Cally
3. **Handles Events**: Listens to Cally's `change` event and converts back to Date for callbacks
4. **Styles**: Uses daisyUI's built-in Cally styles with Tailwind classes

## Native HTML Code (for reference)

Under the hood, the component renders:

```html
<calendar-date class="cally bg-base-100 border border-base-300 shadow-lg rounded-box">
  <svg
    aria-label="Previous"
    class="fill-current size-4"
    slot="previous"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
  >
    <path fill="currentColor" d="M15.75 19.5 8.25 12l7.5-7.5"></path>
  </svg>
  <svg
    aria-label="Next"
    class="fill-current size-4"
    slot="next"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
  >
    <path fill="currentColor" d="m8.25 4.5 7.5 7.5-7.5 7.5"></path>
  </svg>
  <calendar-month></calendar-month>
</calendar-date>
```

## Resources

- [Cally Documentation](https://github.com/WickyNilliams/cally)
- [daisyUI Calendar Styles](https://daisyui.com/components/calendar/)
- [TypeScript Declarations](/types/cally.d.ts)

## Troubleshooting

### Calendar not showing styles

- Ensure daisyUI is installed and configured in `tailwind.config.js`
- Check that the `cally` class is present on the calendar element

### TypeScript errors

- The type declarations are in `/types/cally.d.ts`
- Make sure your `tsconfig.json` includes the types directory

### Calendar not responding to changes

- Verify that `onSelect` or `onValueChange` callback is provided
- Check browser console for any errors
