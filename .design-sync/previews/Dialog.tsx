import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
  Button,
} from 'nabatable-platform';

export const CancelBooking = () => (
  <Dialog defaultOpen>
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Cancel this booking?</DialogTitle>
        <DialogDescription>
          Table 12 · Saturday 8:00 PM · Party of 4. Priya Nair will be notified by SMS that
          the booking was cancelled.
        </DialogDescription>
      </DialogHeader>
      <DialogFooter className="gap-2">
        <Button variant="outline">Keep booking</Button>
        <Button variant="destructive">Cancel booking</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);
