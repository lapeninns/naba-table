import {
  Tabs, TabsList, TabsTrigger, TabsContent,
  Badge,
} from 'nabatable-platform';

export const ServiceTabs = () => (
  <Tabs defaultValue="dinner" className="w-80">
    <TabsList>
      <TabsTrigger value="lunch">Lunch</TabsTrigger>
      <TabsTrigger value="dinner">Dinner</TabsTrigger>
      <TabsTrigger value="bar">Bar</TabsTrigger>
    </TabsList>
    <TabsContent value="lunch" className="text-sm text-muted-foreground">
      12:00–3:00 PM · 6 tables open
    </TabsContent>
    <TabsContent value="dinner" className="text-sm">
      <div className="flex items-center justify-between">
        <span className="font-semibold">Dinner service</span>
        <Badge variant="metric">84 covers</Badge>
      </div>
      <p className="mt-1 text-muted-foreground">5:30–10:00 PM · Sat 8:00 PM peak</p>
    </TabsContent>
    <TabsContent value="bar" className="text-sm text-muted-foreground">
      Walk-ins only · 14 seats
    </TabsContent>
  </Tabs>
);

export const BookingDetailTabs = () => (
  <Tabs defaultValue="guest" className="w-80">
    <TabsList>
      <TabsTrigger value="guest">Guest</TabsTrigger>
      <TabsTrigger value="notes">Notes</TabsTrigger>
      <TabsTrigger value="history">History</TabsTrigger>
    </TabsList>
    <TabsContent value="guest" className="space-y-1 text-sm">
      <p className="font-semibold">Priya Nair</p>
      <p className="text-muted-foreground">Table T12 · Party of 4 · Confirmed</p>
    </TabsContent>
    <TabsContent value="notes" className="text-sm text-muted-foreground">
      Window booth requested · Anniversary · Nut allergy
    </TabsContent>
    <TabsContent value="history" className="text-sm text-muted-foreground">
      3 prior visits · Last seen Fri 9 May
    </TabsContent>
  </Tabs>
);
