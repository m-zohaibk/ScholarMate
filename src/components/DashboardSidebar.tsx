'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { LayoutDashboard, FileText, PenTool, Calendar, Settings, LogOut, Sparkles } from 'lucide-react';

interface SidebarProps { role: 'teacher' | 'student' }

export function DashboardSidebar({ role }: SidebarProps) {
  const pathname = usePathname();
  const items = role === 'teacher'
    ? [{ label: 'Dashboard', href: '/teacher', icon: LayoutDashboard }, { label: 'Quiz Generator', href: '/teacher/quizzes', icon: PenTool }]
    : [{ label: 'Dashboard', href: '/student', icon: LayoutDashboard }, { label: 'Study Notes', href: '/student/notes', icon: FileText }, { label: 'Quizzes', href: '/student/quizzes', icon: PenTool }, { label: 'Study Schedule', href: '/student/schedule', icon: Calendar }];

  return <aside className="h-screen w-64 bg-white border-r flex flex-col fixed left-0 top-0 z-40">
    <div className="p-6"><Link href="/" className="flex items-center gap-2"><div className="bg-primary p-1.5 rounded-lg text-white"><Sparkles className="w-5 h-5" /></div><span className="font-headline font-bold text-lg tracking-tight text-primary leading-tight">AI Academic Hub</span></Link></div>
    <nav className="flex-1 px-4 space-y-1">{items.map((item) => <Link key={item.href} href={item.href} className={cn('flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-all', pathname === item.href ? 'bg-primary text-white shadow-md shadow-primary/20' : 'text-muted-foreground hover:bg-background hover:text-foreground')}><item.icon className="w-5 h-5" />{item.label}</Link>)}</nav>
    <div className="p-4 border-t space-y-1"><Link href="/" className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl text-muted-foreground hover:bg-background hover:text-foreground transition-all"><Settings className="w-5 h-5" />Home</Link><Link href="/" className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl text-destructive hover:bg-destructive/5 transition-all"><LogOut className="w-5 h-5" />Exit Module</Link></div>
  </aside>;
}
