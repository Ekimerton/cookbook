import { getSettings } from '@/lib/settings';
import { getGitStatus } from '@/lib/git';
import SettingsClient from './SettingsClient';

export default async function SettingsPage() {
  const settings = getSettings();
  const gitStatus = await getGitStatus();

  return (
    <SettingsClient
      initialGitRepo={settings.RECIPE_GIT_REPO || ''}
      initialGitStatus={gitStatus}
    />
  );
}
