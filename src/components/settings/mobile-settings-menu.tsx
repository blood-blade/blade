'use client';

import Link from 'next/link';
import { ChevronRight, User, Shield, Palette, Bell, Mail, Image as ImageIcon, CloudSun } from 'lucide-react';
import { settingsItems } from '@/lib/constants';

export function MobileSettingsMenu() {
    return (
        <div className="p-2 space-y-2">
            {settingsItems.map(item => (
                <Link href={item.href} key={item.href} className="flex items-center justify-between p-4 rounded-lg bg-card/50 hover:bg-card/80 transition-colors">
                    <div className="flex items-center gap-4">
                        <item.icon className="h-6 w-6 text-primary" />
                        <div className="flex flex-col">
                            <span className="font-semibold">{item.title}</span>
                            <span className="text-sm text-muted-foreground">{item.description}</span>
                        </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </Link>
            ))}
        </div>
    );
}