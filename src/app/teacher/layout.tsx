import { DashboardSidebar } from '@/components/DashboardSidebar';

export default function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex bg-background min-h-screen">
      <DashboardSidebar role="teacher" />
      <main className="flex-1 ml-64 p-8">
        {children}
      </main>
    </div>
  );
}
