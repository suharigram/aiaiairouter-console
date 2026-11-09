"use client";
import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { createApiKey, revokeApiKey, type KeyActionState } from "@/app/keys/actions";
import { CopyButton } from "@/components/copy-button";
import { SubmitButton } from "@/components/submit-button";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/utils";

type KeyRow = { id: string; name: string; prefix: string; createdAt: string; lastUsedAt: string | null; revokedAt: string | null };

export function KeyManager({ keys }: { keys: KeyRow[] }) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [secretOpen, setSecretOpen] = useState(false);
  const [state, action] = useActionState<KeyActionState, FormData>(async (previous, formData) => {
    const result = await createApiKey(previous, formData);
    if (result.success && result.apiKey) {
      setCreateOpen(false);
      setSecretOpen(true);
      router.refresh();
    }
    return result;
  }, {});
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  function revoke(id: string) {
    setError("");
    startTransition(async () => { try { await revokeApiKey(id); router.refresh(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to revoke key."); } });
  }
  return <>
    <div className="mb-5 flex justify-end"><Dialog open={createOpen} onOpenChange={setCreateOpen}><DialogTrigger asChild><Button variant="accent"><Plus className="h-4 w-4" />Create key</Button></DialogTrigger><DialogContent><DialogTitle className="text-lg font-semibold">Create API key</DialogTitle><DialogDescription className="text-sm text-stone-500">Use a descriptive name. The secret is displayed only once.</DialogDescription><form action={action} className="space-y-4">{state.message && !state.success && <Alert variant="error">{state.message}</Alert>}<div className="space-y-2"><Label htmlFor="key-name">Key name</Label><Input id="key-name" name="name" placeholder="Production backend" maxLength={60} required /></div><SubmitButton variant="accent" className="w-full">Create key</SubmitButton></form></DialogContent></Dialog></div>
    {error && <Alert variant="error" className="mb-4">{error}</Alert>}
    <Table><TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Key</TableHead><TableHead>Created</TableHead><TableHead>Last used</TableHead><TableHead>Status</TableHead><TableHead><span className="sr-only">Actions</span></TableHead></TableRow></TableHeader><TableBody>{keys.map((key) => <TableRow key={key.id}><TableCell className="font-medium">{key.name}</TableCell><TableCell className="font-mono text-xs">{key.prefix}</TableCell><TableCell className="whitespace-nowrap text-stone-500">{formatDate(key.createdAt)}</TableCell><TableCell className="whitespace-nowrap text-stone-500">{key.lastUsedAt ? formatDate(key.lastUsedAt) : "Never"}</TableCell><TableCell><Badge variant={key.revokedAt ? "danger" : "success"}>{key.revokedAt ? "Revoked" : "Active"}</Badge></TableCell><TableCell>{!key.revokedAt && <Dialog><DialogTrigger asChild><Button variant="ghost" size="icon" aria-label={`Revoke ${key.name}`}><Trash2 className="h-4 w-4 text-red-700" /></Button></DialogTrigger><DialogContent><DialogTitle className="text-lg font-semibold">Revoke API key?</DialogTitle><DialogDescription className="text-sm leading-6 text-stone-500">Applications using “{key.name}” will immediately lose access. This cannot be undone.</DialogDescription><div className="flex justify-end gap-2"><Button variant="destructive" disabled={pending} onClick={() => revoke(key.id)}>Revoke key</Button></div></DialogContent></Dialog>}</TableCell></TableRow>)}</TableBody></Table>
    <Dialog open={secretOpen} onOpenChange={setSecretOpen}><DialogContent><DialogTitle className="text-lg font-semibold">Save your API key</DialogTitle><DialogDescription className="text-sm text-stone-500">For security, the plaintext key cannot be recovered after this dialog closes.</DialogDescription><Alert>Store it in a secret manager, not in source control.</Alert><div className="flex items-center gap-2 rounded-md border bg-stone-50 p-2"><code className="min-w-0 flex-1 break-all px-2 text-xs">{state.apiKey}</code>{state.apiKey && <CopyButton value={state.apiKey} label="Copy key" />}</div><Button onClick={() => setSecretOpen(false)} variant="accent">I have saved the key</Button></DialogContent></Dialog>
  </>;
}
