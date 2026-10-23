import { AppShell } from '@/components/AppShell';
import { AuthGate } from '@/components/AuthGate';

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate role="teacher">
      <AppShell role="teacher">{children}</AppShell>
    </AuthGate>
  );
}
