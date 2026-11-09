import Link from "next/link";
import { Logo } from "@/components/logo";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return <main className="flex min-h-screen flex-col items-center justify-center px-5 text-center"><Logo /><h1 className="mt-10 text-3xl font-semibold">Page not found</h1><p className="mt-3 text-sm text-stone-500">The requested route does not exist.</p><Link href="/" className={buttonVariants({ variant: "outline", className: "mt-6" })}>Return home</Link></main>;
}
