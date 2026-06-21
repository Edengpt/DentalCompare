import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
      <p className="text-muted-foreground text-sm font-medium">Phase 0 · Foundation</p>
      <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">DentalCompare</h1>
      <p className="text-muted-foreground max-w-md text-lg">
        פלטפורמה להשוואת מחירים בין רופאי שיניים בישראל. הפרויקט בשלבי הקמה.
      </p>
      <Button size="lg" disabled>
        בקרוב — קבלת הצעות מחיר
      </Button>
    </main>
  );
}
