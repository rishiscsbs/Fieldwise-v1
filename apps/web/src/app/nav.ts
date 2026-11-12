import type { IconName } from '../components/Icon';
import type { PublicUser } from '../lib/api-types';

/** Groups with an empty name render without a heading. */
export interface NavItem {
  key: string;
  path: string;
  icon: IconName;
  /** i18n key in the common namespace */
  label: string;
}

/** Farmer navigation, grouped as in the legacy app. */
export const FARMER_NAV: { group: string; items: NavItem[] }[] = [
  {
    group: 'navGroup1',
    items: [
      { key: 'overview', path: '/app', icon: 'overview', label: 'nav2.overview' },
      { key: 'profile', path: '/app/farm', icon: 'profile', label: 'nav2.profile' },
    ],
  },
  {
    group: 'navGroup2',
    items: [
      { key: 'planner', path: '/app/planner', icon: 'planner', label: 'nav2.planner' },
      { key: 'nutrients', path: '/app/nutrients', icon: 'nutrients', label: 'nav2.nutrients' },
      { key: 'health', path: '/app/health', icon: 'health', label: 'nav2.health' },
      { key: 'weather', path: '/app/weather', icon: 'weather', label: 'nav2.weather' },
      { key: 'market', path: '/app/market', icon: 'market', label: 'nav2.market' },
    ],
  },
  { group: 'navGroup3', items: [{ key: 'desk', path: '/app/desk', icon: 'desk', label: 'nav2.desk' }] },
];

/** Officers work their district; admins also manage users, districts and crops. */
export const OFFICER_NAV: { group: string; items: NavItem[] }[] = [
  {
    group: '',
    items: [
      { key: 'officer', path: '/app/officer', icon: 'overview', label: 'app:shell.officer' },
      { key: 'desk', path: '/app/desk', icon: 'desk', label: 'nav2.desk' },
    ],
  },
];

export const ADMIN_NAV: { group: string; items: NavItem[] }[] = [
  {
    group: '',
    items: [
      { key: 'admin', path: '/app/admin', icon: 'officer', label: 'app:shell.admin' },
      { key: 'officer', path: '/app/officer', icon: 'overview', label: 'app:shell.officer' },
      { key: 'desk', path: '/app/desk', icon: 'desk', label: 'nav2.desk' },
    ],
  },
];

export const navFor = (u: PublicUser | null) =>
  u?.role === 'admin' ? ADMIN_NAV : u?.role === 'officer' ? OFFICER_NAV : FARMER_NAV;
