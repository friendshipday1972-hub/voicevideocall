import { AppTabs, type TabDef } from '@/components/AppTabs';

/** Host app (verified women). Only reachable after KYC approval. */
const TABS: TabDef[] = [
  { name: 'dashboard', title: 'tabs.dashboard', icon: 'grid-outline', iconActive: 'grid' },
  { name: 'host-calls', title: 'tabs.calls', icon: 'call-outline', iconActive: 'call' },
  { name: 'earnings', title: 'tabs.earnings', icon: 'cash-outline', iconActive: 'cash' },
  { name: 'host-profile', title: 'tabs.profile', icon: 'person-outline', iconActive: 'person' },
];

export const unstable_settings = { initialRouteName: 'dashboard' };

export default function HostTabsLayout() {
  return <AppTabs tabs={TABS} />;
}
