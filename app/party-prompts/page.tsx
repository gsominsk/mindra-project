import { getLists, getSettings } from './actions';
import PartyPromptsApp from './PartyPromptsApp';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Party Prompts — Mindra',
  description: 'AI image generation workspace with timer, speech recognition and dashboard management',
};

export default async function PartyPromptsPage() {
  const [lists, settings] = await Promise.all([getLists(), getSettings()]);

  return <PartyPromptsApp serverLists={lists} serverSettings={settings} />;
}
