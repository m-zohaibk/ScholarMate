import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { BookOpen, GraduationCap, ClipboardList, PenTool, Sparkles, Zap } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="px-6 py-4 flex items-center justify-between border-b bg-white/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="bg-primary p-2 rounded-lg text-white">
            <Sparkles className="w-6 h-6" />
          </div>
          <span className="font-headline font-bold text-xl tracking-tight text-primary">Academic Assistant</span>
        </div>
        <nav className="hidden md:flex items-center gap-6">
          <Link href="#features" className="text-sm font-medium hover:text-primary transition-colors">Features</Link>
          <Link href="/student" className="text-sm font-medium hover:text-primary transition-colors">Student Hub</Link>
          <Link href="/teacher" className="text-sm font-medium hover:text-primary transition-colors">Teacher Hub</Link>
          <Button variant="ghost" asChild>
            <Link href="/student">Login</Link>
          </Button>
          <Button asChild>
            <Link href="/student">Get Started</Link>
          </Button>
        </nav>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative py-20 px-6 text-center bg-gradient-to-b from-white to-background">
          <div className="max-w-5xl mx-auto space-y-8">
            <h1 className="font-headline text-4xl md:text-6xl font-bold text-foreground leading-tight">
              Smart Academic <span className="text-primary">Assistant System</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              Using Artificial Intelligence for Automated Assessment and Student Learning Enhancement.
              The all-in-one intelligence platform for modern educators and students.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button size="lg" className="h-12 px-8 text-lg font-medium bg-accent hover:bg-accent/90 shadow-lg shadow-accent/20" asChild>
                <Link href="/student">I&apos;m a Student</Link>
              </Button>
              <Button size="lg" variant="outline" className="h-12 px-8 text-lg font-medium shadow-sm" asChild>
                <Link href="/teacher">I&apos;m a Teacher</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-24 px-6 bg-white">
          <div className="max-w-7xl mx-auto">
            <div className="text-center space-y-4 mb-16">
              <h2 className="font-headline text-3xl md:text-4xl font-bold">Intelligent Tools for Modern Education</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">Streamline your workflow and focus on what truly matters: learning and growth.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              <Card className="border-none shadow-md hover:shadow-xl transition-shadow bg-background/50">
                <CardHeader>
                  <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4 text-primary">
                    <Zap className="w-6 h-6" />
                  </div>
                  <CardTitle className="font-headline">AI Quiz Generator</CardTitle>
                  <CardDescription>Generate comprehensive quizzes from syllabus or study materials in seconds with instant feedback.</CardDescription>
                </CardHeader>
              </Card>

              <Card className="border-none shadow-md hover:shadow-xl transition-shadow bg-background/50">
                <CardHeader>
                  <div className="w-12 h-12 bg-accent/10 rounded-xl flex items-center justify-center mb-4 text-accent">
                    <PenTool className="w-6 h-6" />
                  </div>
                  <CardTitle className="font-headline">Handwriting OCR</CardTitle>
                  <CardDescription>Advanced vision AI understands handwritten notes and transforms them into clean, structured digital notes.</CardDescription>
                </CardHeader>
              </Card>

              <Card className="border-none shadow-md hover:shadow-xl transition-shadow bg-background/50">
                <CardHeader>
                  <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4 text-primary">
                    <ClipboardList className="w-6 h-6" />
                  </div>
                  <CardTitle className="font-headline">Automated Assessment</CardTitle>
                  <CardDescription>Teachers can generate syllabus-aligned exams automatically, reducing workload and increasing efficiency.</CardDescription>
                </CardHeader>
              </Card>
            </div>
          </div>
        </section>
      </main>

      <footer className="py-12 px-6 border-t bg-white">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-2">
            <div className="bg-primary p-2 rounded-lg text-white">
              <Sparkles className="w-4 h-4" />
            </div>
            <span className="font-headline font-bold text-lg text-primary">Smart Academic Assistant</span>
          </div>
          <div className="text-sm text-muted-foreground">
            © 2024 AI Academic Hub. Built for the future of education.
          </div>
        </div>
      </footer>
    </div>
  );
}
