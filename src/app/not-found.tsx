import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function NotFound() {
  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center bg-background px-6 py-24 text-center text-foreground">
      <Card className="mx-auto max-w-md border-border bg-card shadow-sm">
        <CardHeader className="gap-2">
          <CardTitle className="text-2xl font-semibold tracking-tight">
            <h1>Page not found</h1>
          </CardTitle>
          <CardDescription>
            The page you are looking for does not exist or has moved.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <a href="/guest/dashboard">Go to Dashboard</a>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
