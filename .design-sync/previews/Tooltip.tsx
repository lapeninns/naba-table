import {
  Tooltip, TooltipTrigger, TooltipContent, TooltipProvider, Button,
} from 'nabatable-platform';

export const TableInfo = () => (
  <TooltipProvider delayDuration={0}>
    <Tooltip defaultOpen>
      <TooltipTrigger asChild>
        <Button variant="outline">Table 12</Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">Seats 4 · Window booth · Turn time 90 min</TooltipContent>
    </Tooltip>
  </TooltipProvider>
);
