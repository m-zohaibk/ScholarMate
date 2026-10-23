import { AppShell } from '@/components/AppShell';
import { AuthGate } from '@/components/AuthGate';

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate role="student">
      <AppShell role="student">{children}</AppShell>
    </AuthGate>
  );
}
