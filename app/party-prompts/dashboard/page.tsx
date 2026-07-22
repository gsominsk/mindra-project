import { getLists, getSettings } from '../actions';
import PartyPromptsApp from '../PartyPromptsApp';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Dashboard — Party Prompts — Mindra',
  description: 'Party Prompts Dashboard view',
};

export default async function DashboardPage() {
  const [lists, settings] = await Promise.all([getLists(), getSettings()]);

  return <PartyPromptsApp serverLists={lists} serverSettings={settings} initialView="dashboard" />;
}
