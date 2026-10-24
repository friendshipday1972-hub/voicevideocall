import { AppTabs, type TabDef } from '@/components/AppTabs';

/** Caller app (men and other genders). */
const TABS: TabDef[] = [
  { name: 'index', title: 'tabs.home', icon: 'home-outline', iconActive: 'home' },
  { name: 'calls', title: 'tabs.calls', icon: 'call-outline', iconActive: 'call' },
  { name: 'wallet', title: 'tabs.wallet', icon: 'wallet-outline', iconActive: 'wallet' },
  { name: 'profile', title: 'tabs.profile', icon: 'person-outline', iconActive: 'person' },
];

export default function UserTabsLayout() {
  return <AppTabs tabs={TABS} />;
}
