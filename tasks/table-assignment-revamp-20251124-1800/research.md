---
task: table-assignment-revamp
timestamp_utc: 2025-11-24T18:00:00Z
owner: github:@amanshresthaa
reviewers: []
risk: low
flags: []
related_tickets: []
---

# Research: Table Assignment Interface Revamp

## Requirements

### Functional Requirements

- Display booking details (guest info, date, time, party size)
- Show floor plan with table layout and coordinates
- Enable manual table selection with visual feedback
- Show currently assigned tables
- Allow assigning/unassigning tables
- Display validation checks and capacity calculations
- Support "Available only" filter toggle
- Handle empty states (no floor plan coordinates, no tables)

### Non-Functional Requirements

- **Accessibility**: WCAG 2.1 AA compliant, keyboard navigation, screen reader support
- **Performance**: Smooth interactions, no layout shifts, fast rendering
- **Security**: Proper authorization checks (already handled by backend)
- **Privacy**: Guest data displayed appropriately
- **Responsiveness**: Mobile-first design, works on 320px+ screens
- **Usability**: Clear visual hierarchy, intuitive interactions, helpful error messages

## Existing Patterns & Reuse

### Current Implementation Analysis

**Files:**

1. `BookingDetailsDialog.tsx` (790 lines) - Main dialog container
2. `BookingAssignmentTabContent.tsx` (437 lines) - Table assignment tab
3. `AssignmentToolbar.tsx` (164 lines) - Toolbar with stats and actions
4. `TableFloorPlan.tsx` - Floor plan visualization (referenced, not viewed)
5. `ValidationChecks.tsx` - Validation display (referenced, not viewed)

### Existing UI Components (Shadcn)

✅ Already using:

- Dialog, DialogContent, DialogHeader
- Tabs, TabsList, TabsTrigger, TabsContent
- Card, CardHeader, CardTitle, CardDescription, CardContent
- Button, Badge, Switch, Label
- Alert, AlertDialog
- Tooltip

### Current Strengths

✅ Clean separation of concerns (dialog, tab content, toolbar)
✅ Proper loading and error states
✅ Mutation handling with optimistic updates
✅ Accessibility attributes (aria-labels, roles)
✅ Responsive grid layouts

### Current Pain Points (UX/UI)

❌ Layout feels cramped and dated
❌ Limited visual hierarchy - everything has similar weight
❌ Guest context sidebar could be more elegant
❌ Party size and table selection stats feel disconnected
❌ Empty state ("No floor plan coordinates") lacks polish
❌ Assigned tables section lacks visual appeal
❌ Color usage is minimal - mostly gray tones
❌ Icons are underutilized for quick scanning
❌ Mobile experience could be improved
❌ Transitions and animations are minimal

## External Resources

### Design Inspiration

- [Airbnb Host Dashboard](https://airbnb.com) - Clean layouts, card-based design
- [Notion](https://notion.so) - Excellent sidebar + main content split
- [Linear](https://linear.app) - Modern toolbar design, great micro-interactions
- [Stripe Dashboard](https://stripe.com) - Professional data visualization

### UX Best Practices

- [Nielsen Norman Group - Dashboard Design](https://www.nngroup.com/articles/dashboard-design) - Data density, visual hierarchy
- [Material Design 3](https://m3.material.io) - Color systems, elevation, states
- [WAI-ARIA APG](https://www.w3.org/WAI/ARIA/apg) - Accessibility patterns

## Constraints & Risks

### Constraints

- Must maintain existing TypeScript interfaces
- Cannot break backend API contracts
- Must preserve all existing functionality
- Need to support existing dark mode
- Should work with current Shadcn UI component library
- Must maintain keyboard shortcuts functionality

### Risks

- **Low Risk**: This is UI-only changes, no backend modifications
- **Data Risk**: None - only changing presentation layer
- **Performance Risk**: Low - using compositor-friendly CSS
- **Accessibility Risk**: Low - will maintain/improve ARIA attributes

### Technical Constraints

- React Query mutations must remain unchanged
- Dialog modal behavior must be preserved
- Tab navigation logic stays the same
- Assignment validation logic is server-side (good!)

## Open Questions

1. **Q: Should we add animations when tables are assigned/unassigned?**
   A: YES - subtle fade and scale animations (200-300ms)
   Owner: @amanshresthaa
   Due: Implementation phase

2. **Q: Should the floor plan support zoom/pan for better mobile experience?**
   A: DEFER - Focus on layout improvements first, advanced interactions later
   Owner: @amanshresthaa
   Due: Future iteration

3. **Q: Should we redesign the TableFloorPlan component itself?**
   A: OUT OF SCOPE - Focus on the containing layout and toolbar this iteration
   Owner: @amanshresthaa
   Due: N/A

## Recommended Direction

### Design System Enhancements

1. **Color Strategy**
   - Use HSL semantic colors from `globals.css`
   - Accent colors for interactive elements (primary, success, warning, destructive)
   - Subtle gradients for visual interest
   - Better contrast for dark mode

2. **Typography Hierarchy**
   - Larger, bolder headings (text-2xl for dialog title)
   - Clear size differentiation (heading > subheading > body > caption)
   - Proper use of font weights (semibold for emphasis, normal for body)
   - Improved spacing (letter-spacing, line-height)

3. **Spacing & Layout**
   - Consistent gaps (4, 6, 8 for primary spacing units)
   - Generous padding for clickable areas (p-4, p-6)
   - Clear section separation (borders, backgrounds)
   - Better use of whitespace

4. **Iconography**
   - Icon for every significant data point
   - Color-coded icons (primary for actions, muted for labels)
   - Consistent sizes (h-4 w-4 for inline, h-5 w-5 for emphasis)
   - Lucide icons (already in use)

### Layout Improvements

1. **Left Sidebar (Guest Context)**
   - Larger avatar/initials (h-20 w-20)
   - Prominent tier badge with gradient
   - Contact cards with hover effects
   - Collapsible sections for preferences/notes
   - Better mobile stacking

2. **Right Panel (Operations)**
   - Sticky header with booking date/time/status
   - Tabbed interface (Overview | Tables)
   - Improved toolbar with better visual balance
   - Floor plan with loading skeletons
   - Elegant assigned tables list with grid layout

3. **Assignment Toolbar**
   - Visual card with shadow/border
   - Highlighted party size vs. selected capacity
   - Progress indicator (visual bar or circular progress)
   - Clearer CTAs (larger "Assign Tables" button)
   - Better toggle switch styling

4. **Assigned Tables Section**
   - Card-based grid (not just list)
   - Mini table preview (number, capacity, zone)
   - Remove button with confirmation
   - Smooth removal animation
   - Merged tables indicator with visual link

### Micro-Interactions

1. **Hover States**
   - Table cards: lift + shadow
   - Buttons: scale + brightness
   - Contact links: underline + color shift

2. **Click/Tap Feedback**
   - Button press: scale down (0.98)
   - Table selection: immediate visual state change
   - Success toast after assignment

3. **Transitions**
   - Tab switching: fade + slide (200ms)
   - Table assignment: fade in (300ms)
   - Dialog open/close: scale + fade (200ms)

### Empty States

1. **No Floor Plan**
   - Illustration or icon (layout-grid crossed out)
   - Helpful message
   - List of tables below as fallback (already exists)

2. **No Assigned Tables**
   - Friendly icon (clipboard-list)
   - Encouraging message
   - CTA to assign tables

3. **No Tables Available**
   - Warning icon
   - Clear explanation
   - Suggestion (contact admin, check configuration)

## Reuse Summary

**Components to Reuse:**

- ✅ All Shadcn UI components (Dialog, Tabs, Card, Button, Badge, etc.)
- ✅ Existing mutations and queries
- ✅ TableFloorPlan component (will enhance wrapper)
- ✅ Booking state machine integration
- ✅ Toast notification system

**Patterns to Maintain:**

- ✅ Two-panel dialog layout (sidebar + main)
- ✅ Tabbed navigation (Overview | Tables)
- ✅ Assignment toolbar + floor plan + assigned list structure
- ✅ Direct assignment API flow
- ✅ Validation error handling

**What Will Change:**

- 🎨 Visual styling (colors, spacing, typography)
- 🎨 Component layouts and hierarchies
- 🎨 Icon usage and placement
- 🎨 Animations and transitions
- 🎨 Empty state designs
- 🎨 Mobile responsive breakpoints
