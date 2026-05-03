"use client"

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { Clock, CheckCircle2, Circle, Sparkles, Bell } from 'lucide-react';

export default function StudySchedulePlanner() {
  const [date, setDate] = useState<Date | undefined>(new Date());

  const tasks = [
    { time: '09:00 AM', title: 'Calculus Review', duration: '1h 30m', completed: true, category: 'Math' },
    { time: '11:00 AM', title: 'Biology Quiz Session', duration: '45m', completed: false, category: 'Science' },
    { time: '02:00 PM', title: 'Literature Notes Prep', duration: '2h', completed: false, category: 'Arts' },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="font-headline text-3xl font-bold">Study Planner</h1>
          <p className="text-muted-foreground">Personalized schedule optimized for your learning pace.</p>
        </div>
        <Button className="bg-accent hover:bg-accent/90 shadow-lg shadow-accent/20">
          <Sparkles className="w-4 h-4 mr-2" />
          AI Optimize Schedule
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4">
          <Card className="border-none shadow-sm">
            <CardContent className="p-4">
              <Calendar
                mode="single"
                selected={date}
                onSelect={setDate}
                className="rounded-md"
              />
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm mt-6">
            <CardHeader>
              <CardTitle className="text-lg">Daily Goals</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Focus Time</span>
                <span className="font-bold">4.5 / 6h</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                <div className="bg-primary h-full w-3/4" />
              </div>
              <div className="grid grid-cols-2 gap-2 mt-4">
                <div className="p-3 bg-primary/5 rounded-xl text-center">
                  <p className="text-xl font-bold text-primary">3</p>
                  <p className="text-[10px] uppercase font-bold text-muted-foreground">Completed</p>
                </div>
                <div className="p-3 bg-accent/5 rounded-xl text-center">
                  <p className="text-xl font-bold text-accent">2</p>
                  <p className="text-[10px] uppercase font-bold text-muted-foreground">Remaining</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-8 space-y-6">
          <Card className="border-none shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="font-headline">Schedule for Today</CardTitle>
                <CardDescription>Wednesday, June 12th</CardDescription>
              </div>
              <Badge variant="outline" className="flex gap-1 text-primary border-primary/20">
                <Bell className="w-3 h-3" /> Reminders Active
              </Badge>
            </CardHeader>
            <CardContent className="space-y-0 p-0">
              {tasks.map((task, idx) => (
                <div key={idx} className="group flex items-start gap-6 p-6 border-b last:border-0 hover:bg-primary/5 transition-colors">
                  <div className="text-sm font-bold text-muted-foreground w-20 pt-1">
                    {task.time}
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <h4 className={cn("font-bold text-lg", task.completed ? "text-muted-foreground line-through" : "")}>
                        {task.title}
                      </h4>
                      <Badge variant="secondary" className="font-medium">{task.category}</Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {task.duration}
                      </span>
                    </div>
                  </div>
                  <button className={cn(
                    "p-2 rounded-xl transition-all",
                    task.completed ? "bg-green-100 text-green-600" : "bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary"
                  )}>
                    {task.completed ? <CheckCircle2 className="w-6 h-6" /> : <Circle className="w-6 h-6" />}
                  </button>
                </div>
              ))}

              <div className="p-8 flex flex-col items-center justify-center text-center opacity-40">
                <Button variant="ghost" className="rounded-full h-12 w-12 p-0 border border-dashed mb-2">
                  <span className="text-2xl">+</span>
                </Button>
                <p className="text-sm font-medium">Add task for the afternoon</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

import { cn } from '@/lib/utils';
