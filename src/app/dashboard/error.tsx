"use client";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

export default function DashboardError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <div className="space-y-4"><Alert variant="error">This page could not load. Check the database connection and try again.</Alert><Button onClick={reset} variant="outline">Try again</Button></div>;
}
