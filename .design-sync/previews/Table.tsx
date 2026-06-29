import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableCaption,
  Badge,
} from 'nabatable-platform';

export const BookingsTable = () => (
  <div className="w-[34rem] rounded-lg border">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Time</TableHead>
          <TableHead>Guest</TableHead>
          <TableHead>Table</TableHead>
          <TableHead className="text-right">Covers</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell className="tabular-nums">7:45 PM</TableCell>
          <TableCell className="font-medium">Priya Nair</TableCell>
          <TableCell>T12</TableCell>
          <TableCell className="text-right tabular-nums">4</TableCell>
          <TableCell><Badge variant="status-confirmed">Confirmed</Badge></TableCell>
        </TableRow>
        <TableRow>
          <TableCell className="tabular-nums">8:00 PM</TableCell>
          <TableCell className="font-medium">Tom Hill</TableCell>
          <TableCell>T1</TableCell>
          <TableCell className="text-right tabular-nums">2</TableCell>
          <TableCell><Badge variant="status-completed">Seated</Badge></TableCell>
        </TableRow>
        <TableRow>
          <TableCell className="tabular-nums">8:15 PM</TableCell>
          <TableCell className="font-medium">Aisha Khan</TableCell>
          <TableCell>T7</TableCell>
          <TableCell className="text-right tabular-nums">6</TableCell>
          <TableCell><Badge variant="status-pending">Pending</Badge></TableCell>
        </TableRow>
        <TableRow>
          <TableCell className="tabular-nums">8:30 PM</TableCell>
          <TableCell className="font-medium">James Okoro</TableCell>
          <TableCell>T4</TableCell>
          <TableCell className="text-right tabular-nums">3</TableCell>
          <TableCell><Badge variant="status-cancelled">No-show</Badge></TableCell>
        </TableRow>
      </TableBody>
    </Table>
  </div>
);

export const CapacityTable = () => (
  <div className="w-80 rounded-lg border">
    <Table>
      <TableCaption>Tonight&apos;s covers by service</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Service</TableHead>
          <TableHead className="text-right">Booked</TableHead>
          <TableHead className="text-right">Capacity</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell className="font-medium">Lunch</TableCell>
          <TableCell className="text-right tabular-nums">38</TableCell>
          <TableCell className="text-right tabular-nums">60</TableCell>
        </TableRow>
        <TableRow>
          <TableCell className="font-medium">Dinner</TableCell>
          <TableCell className="text-right tabular-nums">84</TableCell>
          <TableCell className="text-right tabular-nums">90</TableCell>
        </TableRow>
        <TableRow>
          <TableCell className="font-medium">Bar</TableCell>
          <TableCell className="text-right tabular-nums">11</TableCell>
          <TableCell className="text-right tabular-nums">14</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  </div>
);
