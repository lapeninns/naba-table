import {
  Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter,
  Button, Badge,
} from 'nabatable-platform';

export const BookingCard = () => (
  <Card className="w-80">
    <CardHeader>
      <CardTitle>Table 12 · Dinner</CardTitle>
      <CardDescription>Saturday 8:00 PM · Party of 4</CardDescription>
    </CardHeader>
    <CardContent className="text-sm text-muted-foreground">
      <p>Priya Nair · 07700 900123</p>
      <p className="mt-1">Window booth requested · Anniversary</p>
    </CardContent>
    <CardFooter className="gap-2">
      <Button size="sm">Seat now</Button>
      <Button size="sm" variant="outline">Message</Button>
    </CardFooter>
  </Card>
);

export const MetricCard = () => (
  <Card className="w-64">
    <CardHeader className="pb-2">
      <CardDescription>Covers tonight</CardDescription>
      <CardTitle className="text-3xl tabular-nums">84</CardTitle>
    </CardHeader>
    <CardContent>
      <Badge variant="metric">+12 vs last week</Badge>
    </CardContent>
  </Card>
);
