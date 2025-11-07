# Context Artifacts

## table-assignment-code.json

Generated snapshot of the table-assignment engine sources.

Regenerate after editing any of the files listed below:

```
node -e "const fs=require('fs'); const files=['server/capacity/tables.ts','server/capacity/table-assignment/assignment.ts','server/capacity/table-assignment/availability.ts','server/capacity/table-assignment/booking-window.ts','server/capacity/table-assignment/constants.ts','server/capacity/table-assignment/index.ts','server/capacity/table-assignment/manual.ts','server/capacity/table-assignment/quote.ts','server/capacity/table-assignment/supabase.ts','server/capacity/table-assignment/types.ts','server/capacity/table-assignment/utils.ts']; const sorted=[...files].sort(); const data={}; for (const file of sorted){ data[file]=fs.readFileSync(file,'utf8'); } fs.writeFileSync('context/table-assignment-code.json', JSON.stringify(data,null,2)+'\n');"
```
