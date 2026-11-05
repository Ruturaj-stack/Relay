import {
  Activity,
  BarChart3,
  Bell,
  LayoutDashboard,
  Package,
  Settings,
  Users,
  ArrowLeftRight,
  ScanLine,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  label: string
  path: string
  icon: LucideIcon
  group: 'workspace' | 'insights' | 'account'
  description?: string
}

export const navItems: NavItem[] = [
  {
    label: 'Overview',
    path: '/',
    icon: LayoutDashboard,
    group: 'workspace',
    description: 'Your handoffs, at a glance',
  },
  {
    label: 'Handoffs',
    path: '/handoffs',
    icon: ArrowLeftRight,
    group: 'workspace',
    description: 'Track every transfer',
  },
  {
    label: 'Items',
    path: '/items',
    icon: Package,
    group: 'workspace',
    description: 'Inventory and condition history',
  },
  {
    label: 'People & teams',
    path: '/people',
    icon: Users,
    group: 'workspace',
    description: 'Members, roles and shared gear',
  },
  {
    label: 'Activity',
    path: '/activity',
    icon: Activity,
    group: 'workspace',
    description: 'The full trust record',
  },
  {
    label: 'Analytics',
    path: '/analytics',
    icon: BarChart3,
    group: 'insights',
    description: 'Patterns across your workspace',
  },
  {
    label: 'Notifications',
    path: '/notifications',
    icon: Bell,
    group: 'account',
    description: 'Requests, reminders and updates',
  },
  {
    label: 'Settings',
    path: '/settings',
    icon: Settings,
    group: 'account',
    description: 'Profile, appearance and security',
  },
]

export const mobileNavItems = [
  { label: 'Home', path: '/', icon: LayoutDashboard },
  { label: 'Handoffs', path: '/handoffs', icon: ArrowLeftRight },
  { label: 'Scan', path: '/scan', icon: ScanLine, primary: true },
  { label: 'Items', path: '/items', icon: Package },
]

export const moreNavItems = [
  { label: 'People & teams', path: '/people', icon: Users },
  { label: 'Activity', path: '/activity', icon: Activity },
  { label: 'Analytics', path: '/analytics', icon: BarChart3 },
  { label: 'Notifications', path: '/notifications', icon: Bell },
  { label: 'Settings', path: '/settings', icon: Settings },
]
