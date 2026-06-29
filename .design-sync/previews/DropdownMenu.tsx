import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, Button,
} from 'nabatable-platform';

export const BookingActions = () => (
  <DropdownMenu defaultOpen>
    <DropdownMenuTrigger asChild>
      <Button variant="outline">Booking actions</Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="start" className="w-52">
      <DropdownMenuLabel>Table 12 · Party of 4</DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuItem>Seat now</DropdownMenuItem>
      <DropdownMenuItem>Move table</DropdownMenuItem>
      <DropdownMenuItem>Message guest</DropdownMenuItem>
      <DropdownMenuItem>Mark no-show</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
);
