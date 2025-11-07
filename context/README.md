# Context Artifacts

## table-assignment-code.json

Generated snapshot of the table-assignment engine sources.

Regenerate after editing any of the files listed below:

```
node -e "const fs=require('fs'); const files=['server/capacity/tables.ts','server/capacity/table-assignment/assignment.ts','server/capacity/table-assignment/availability.ts','server/capacity/table-assignment/booking-window.ts','server/capacity/table-assignment/constants.ts','server/capacity/table-assignment/index.ts','server/capacity/table-assignment/manual.ts','server/capacity/table-assignment/quote.ts','server/capacity/table-assignment/supabase.ts','server/capacity/table-assignment/types.ts','server/capacity/table-assignment/utils.ts']; const sorted=[...files].sort(); const data={}; for (const file of sorted){ data[file]=fs.readFileSync(file,'utf8'); } fs.writeFileSync('context/table-assignment-code.json', JSON.stringify(data,null,2)+'\n');"
```

## wizard-steps-consolidated.json

Snapshot of the Booking Wizard frontend steps (Plan, Details, Review, Confirmation) including their supporting forms, components, types, and hooks.

Regenerate after editing any of the files listed below:

```
node -e "const fs=require('fs'); const files=[
  'reserve/features/reservations/wizard/ui/steps/PlanStep.tsx',
  'reserve/features/reservations/wizard/ui/steps/DetailsStep.tsx',
  'reserve/features/reservations/wizard/ui/steps/ReviewStep.tsx',
  'reserve/features/reservations/wizard/ui/steps/ConfirmationStep.tsx',
  'reserve/features/reservations/wizard/ui/steps/plan-step/PlanStepForm.tsx',
  'reserve/features/reservations/wizard/ui/steps/plan-step/components/Calendar24Field.tsx',
  'reserve/features/reservations/wizard/ui/steps/plan-step/components/NotesField.tsx',
  'reserve/features/reservations/wizard/ui/steps/plan-step/components/OccasionPicker.tsx',
  'reserve/features/reservations/wizard/ui/steps/plan-step/components/PartySizeField.tsx',
  'reserve/features/reservations/wizard/ui/steps/plan-step/components/TimeSlotGrid.tsx',
  'reserve/features/reservations/wizard/ui/steps/plan-step/components/index.ts',
  'reserve/features/reservations/wizard/ui/steps/plan-step/types.ts',
  'reserve/features/reservations/wizard/ui/steps/details-step/types.ts',
  'reserve/features/reservations/wizard/ui/steps/review-step/types.ts',
  'reserve/features/reservations/wizard/ui/steps/confirmation-step/types.ts',
  'reserve/features/reservations/wizard/hooks/usePlanStepForm.ts',
  'reserve/features/reservations/wizard/hooks/useDetailsStepForm.ts',
  'reserve/features/reservations/wizard/hooks/useReviewStep.ts',
  'reserve/features/reservations/wizard/hooks/useConfirmationStep.ts'
]; const sorted=[...files].sort(); const data={}; for (const file of sorted){ data[file]=fs.readFileSync(file,'utf8'); } fs.writeFileSync('context/wizard-steps-consolidated.json', JSON.stringify(data,null,2)+'\n');"
```
