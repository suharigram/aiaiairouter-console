import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { SettingsForms } from "@/components/dashboard/settings-forms";
import { PageHeader } from "@/components/page-header";

export default async function SettingsPage() {
  const user = await requireUser();
  const profile = await db.profile.findUniqueOrThrow({ where: { id: user.id } });
  return <><PageHeader title="Settings / Profile" description="Manage account identity and authentication details." /><SettingsForms name={profile.name ?? ""} email={profile.email} /></>;
}
