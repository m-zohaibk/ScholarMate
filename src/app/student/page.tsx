import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BookOpen, Trophy, Clock, Calendar, ArrowRight, Zap } from 'lucide-react';
import Link from 'next/link';

export default function StudentDashboard() {
  const activities = [
    { title: 'Biology Notes', type: 'Notes', date: '1h ago', icon: BookOpen },
    { title: 'Algebra Practice', type: 'Quiz', date: 'Yesterday', icon: Zap },
    { title: 'Literature History', type: 'Notes', date: '2 days ago', icon: BookOpen },
  ];

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="font-headline text-3xl font-bold">Hello, Alex</h1>
          <p className="text-muted-foreground">Ready to tackle your study sessions today?</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" asChild>
            <Link href="/student/schedule">View Calendar</Link>
          </Button>
          <Button className="bg-accent hover:bg-accent/90 shadow-lg shadow-accent/20" asChild>
            <Link href="/student/notes">Create New Notes</Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-none shadow-sm bg-gradient-to-br from-primary to-primary/80 text-white">
          <CardContent className="pt-6">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <p className="text-primary-foreground/80 text-sm font-medium">Study Streak</p>
                <p className="text-4xl font-bold">12 Days</p>
              </div>
              <div className="bg-white/20 p-3 rounded-2xl">
                <Trophy className="w-6 h-6" />
              </div>
            </div>
            <div className="mt-6 text-sm text-primary-foreground/90 bg-white/10 p-2 rounded-lg text-center">
              You're in the top 5% of learners!
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardContent className="pt-6">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <p className="text-muted-foreground text-sm font-medium">Completed Quizzes</p>
                <p className="text-4xl font-bold">48</p>
              </div>
              <div className="bg-accent/10 p-3 rounded-2xl text-accent">
                <Zap className="w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardContent className="pt-6">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <p className="text-muted-foreground text-sm font-medium">Time Studied</p>
                <p className="text-4xl font-bold">24h 15m</p>
              </div>
              <div className="bg-green-100 p-3 rounded-2xl text-green-600">
                <Clock className="w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="border-none shadow-sm lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="font-headline">Recent Study Assets</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/student/notes">View All <ArrowRight className="w-4 h-4 ml-1" /></Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {activities.map((act, idx) => (
                <div key={idx} className="flex items-center justify-between p-4 rounded-xl border bg-white/50 hover:bg-white transition-all cursor-pointer group">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-background rounded-xl group-hover:bg-primary/5 transition-colors">
                      <act.icon className="w-5 h-5 text-muted-foreground group-hover:text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{act.title}</p>
                      <p className="text-xs text-muted-foreground">{act.type} • Last accessed {act.date}</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="rounded-full">
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="font-headline">Upcoming Challenges</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 rounded-xl bg-accent/5 border border-accent/10 space-y-3">
              <div className="flex items-center gap-2 text-accent">
                <Calendar className="w-4 h-4" />
                <span className="text-sm font-bold">Today's Goal</span>
              </div>
              <p className="text-sm font-medium">Complete 2 Calculus Quizzes to unlock a new study badge.</p>
              <Button size="sm" className="w-full bg-accent hover:bg-accent/90">Go to Quizzes</Button>
            </div>

            <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 space-y-3">
              <div className="flex items-center gap-2 text-primary">
                <Clock className="w-4 h-4" />
                <span className="text-sm font-bold">Study Plan</span>
              </div>
              <p className="text-sm font-medium">Your next focus session: History of Art starts at 4:00 PM.</p>
              <Button size="sm" variant="outline" className="w-full">View Schedule</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
