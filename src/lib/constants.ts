import { User, Shield, Palette, Bell, Mail, Image as ImageIcon, CloudSun } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface SettingsItem {
    href: string;
    icon: LucideIcon;
    title: string;
    description: string;
}

export const settingsItems: SettingsItem[] = [
    {
        href: '/settings/profile',
        icon: User,
        title: 'Profile',
        description: 'Manage your public profile information.'
    },
    {
        href: '/settings/account',
        icon: Shield,
        title: 'Account',
        description: 'Manage your account security and data.'
    },
    {
        href: '/settings/notifications',
        icon: Bell,
        title: 'Notifications',
        description: 'Manage how you get notified.'
    },
    {
        href: '/settings/appearance',
        icon: Palette,
        title: 'Appearance',
        description: 'Customize the look and feel of the app.'
    },
    {
        href: '/settings/backgrounds',
        icon: ImageIcon,
        title: 'Backgrounds',
        description: 'Choose your app background.'
    },
    {
        href: '/settings/weather',
        icon: CloudSun,
        title: 'Weather',
        description: 'Customize the weather widget.'
    },
    {
        href: '/settings/feedback',
        icon: Mail,
        title: 'Feedback',
        description: 'Send us your thoughts and suggestions.'
    }
];