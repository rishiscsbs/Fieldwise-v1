import type { IconName } from '../components/Icon';
import type { PublicUser } from '../lib/api-types';

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

/** Officers and admins get the desk now; their dashboards arrive in phase 4. */
export const STAFF_NAV: { group: string; items: NavItem[] }[] = [
  {
    group: 'navGroup3',
    items: [
      { key: 'desk', path: '/app/desk', icon: 'desk', label: 'nav2.desk' },
      { key: 'officer', path: '/app/officer', icon: 'officer', label: 'app:shell.officerSoon' },
    ],
  },
];

export const navFor = (u: PublicUser | null) => (u && u.role !== 'farmer' ? STAFF_NAV : FARMER_NAV);
