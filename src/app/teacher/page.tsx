import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PenTool, Users, FileCheck, History } from 'lucide-react';
import Link from 'next/link';

export default function TeacherDashboard() {
  const stats = [
    { label: 'Active Quizzes', value: '12', icon: FileCheck, color: 'text-primary bg-primary/10' },
    { label: 'Student Users', value: '248', icon: Users, color: 'text-accent bg-accent/10' },
    { label: 'Average Score', value: '78%', icon: History, color: 'text-green-600 bg-green-50' },
  ];

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="font-headline text-3xl font-bold">Welcome, Professor</h1>
          <p className="text-muted-foreground">Manage your assessments and monitor student progress.</p>
        </div>
        <Button size="lg" className="rounded-xl shadow-lg shadow-primary/20" asChild>
          <Link href="/teacher/quizzes">
            <PenTool className="w-4 h-4 mr-2" />
            Generate New Quiz
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map((stat) => (
          <Card key={stat.label} className="border-none shadow-sm">
            <CardContent className="pt-6 flex items-center gap-4">
              <div className={cn("p-3 rounded-xl", stat.color)}>
                <stat.icon className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
                <p className="text-2xl font-bold">{stat.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="font-headline">Recent Quizzes</CardTitle>
            <CardDescription>Your latest generated assessments.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between p-4 rounded-xl border bg-white/50 hover:bg-white transition-colors cursor-pointer group">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-background rounded-lg group-hover:bg-primary/10 transition-colors">
                      <FileCheck className="w-5 h-5 text-muted-foreground group-hover:text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">Calculus II: Derivatives {i}</p>
                      <p className="text-xs text-muted-foreground">Created 2 days ago • 15 Questions</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm">View</Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="font-headline">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <Button variant="outline" className="h-24 flex-col gap-2 rounded-2xl hover:bg-primary/5 hover:text-primary hover:border-primary/20">
              <Users className="w-6 h-6" />
              Manage Classes
            </Button>
            <Button variant="outline" className="h-24 flex-col gap-2 rounded-2xl hover:bg-accent/5 hover:text-accent hover:border-accent/20">
              <History className="w-6 h-6" />
              Review Analytics
            </Button>
            <Button variant="outline" className="h-24 flex-col gap-2 rounded-2xl col-span-2">
              Import Syllabus (PDF)
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

import { cn } from '@/lib/utils';
