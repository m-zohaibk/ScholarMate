import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { BookOpen, GraduationCap, ClipboardList, PenTool, Sparkles, Zap } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="px-6 py-4 flex items-center justify-between border-b bg-white/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="bg-primary p-2 rounded-lg">
            <Sparkles className="text-white w-6 h-6" />
          </div>
          <span className="font-headline font-bold text-xl tracking-tight text-primary">ScholarMate AI</span>
        </div>
        <nav className="hidden md:flex items-center gap-6">
          <Link href="#features" className="text-sm font-medium hover:text-primary transition-colors">Features</Link>
          <Link href="#pricing" className="text-sm font-medium hover:text-primary transition-colors">Pricing</Link>
          <Button variant="ghost" asChild>
            <Link href="/auth">Login</Link>
          </Button>
          <Button asChild>
            <Link href="/auth">Get Started</Link>
          </Button>
        </nav>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative py-20 px-6 text-center bg-gradient-to-b from-white to-background">
          <div className="max-w-4xl mx-auto space-y-8">
            <h1 className="font-headline text-5xl md:text-7xl font-bold text-foreground leading-tight">
              Elevate Your <span className="text-primary">Academic Journey</span> with AI
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              The all-in-one intelligence platform for teachers to generate assessments and students to master study materials.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button size="lg" className="h-12 px-8 text-lg font-medium bg-accent hover:bg-accent/90 shadow-lg shadow-accent/20" asChild>
                <Link href="/student">I'm a Student</Link>
              </Button>
              <Button size="lg" variant="outline" className="h-12 px-8 text-lg font-medium shadow-sm" asChild>
                <Link href="/teacher">I'm a Teacher</Link>
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
                  <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4">
                    <Zap className="text-primary w-6 h-6" />
                  </div>
                  <CardTitle className="font-headline">AI Quiz Generator</CardTitle>
                  <CardDescription>Generate comprehensive quizzes from syllabus or study materials in seconds.</CardDescription>
                </CardHeader>
              </Card>

              <Card className="border-none shadow-md hover:shadow-xl transition-shadow bg-background/50">
                <CardHeader>
                  <div className="w-12 h-12 bg-accent/10 rounded-xl flex items-center justify-center mb-4">
                    <PenTool className="text-accent w-6 h-6" />
                  </div>
                  <CardTitle className="font-headline">Structured Notes</CardTitle>
                  <CardDescription>Transform long documents into clear, hierarchical study notes automatically.</CardDescription>
                </CardHeader>
              </Card>

              <Card className="border-none shadow-md hover:shadow-xl transition-shadow bg-background/50">
                <CardHeader>
                  <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4">
                    <ClipboardList className="text-primary w-6 h-6" />
                  </div>
                  <CardTitle className="font-headline">Study Planner</CardTitle>
                  <CardDescription>Get personalized schedules and daily challenges to stay on track.</CardDescription>
                </CardHeader>
              </Card>
            </div>
          </div>
        </section>

        {/* Roles Section */}
        <section className="py-24 px-6 bg-background">
          <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12">
            <div className="space-y-6">
              <div className="bg-primary/10 w-fit px-4 py-1 rounded-full text-primary font-bold text-sm">TEACHERS</div>
              <h3 className="font-headline text-3xl font-bold">Empower Your Teaching</h3>
              <p className="text-muted-foreground leading-relaxed">
                Save hours on lesson planning and assessment creation. Generate high-quality MCQs, conceptual questions, and syllabus-aligned quizzes with a few clicks.
              </p>
              <ul className="space-y-3">
                <li className="flex items-center gap-2 text-sm font-medium"><GraduationCap className="w-4 h-4 text-primary" /> Syllabus-based Generation</li>
                <li className="flex items-center gap-2 text-sm font-medium"><GraduationCap className="w-4 h-4 text-primary" /> Adjustable Difficulty Levels</li>
                <li className="flex items-center gap-2 text-sm font-medium"><GraduationCap className="w-4 h-4 text-primary" /> Keyword Inclusion/Exclusion</li>
              </ul>
              <Button asChild>
                <Link href="/teacher">Explore Teacher Dashboard</Link>
              </Button>
            </div>
            <div className="space-y-6">
              <div className="bg-accent/10 w-fit px-4 py-1 rounded-full text-accent font-bold text-sm">STUDENTS</div>
              <h3 className="font-headline text-3xl font-bold">Master Any Topic</h3>
              <p className="text-muted-foreground leading-relaxed">
                Turn your textbooks and lecture slides into interactive study tools. Get structured notes, highlights, and timed quizzes tailored to your content.
              </p>
              <ul className="space-y-3">
                <li className="flex items-center gap-2 text-sm font-medium"><BookOpen className="w-4 h-4 text-accent" /> PDF/PPTX/DOCX Processing</li>
                <li className="flex items-center gap-2 text-sm font-medium"><BookOpen className="w-4 h-4 text-accent" /> AI Concept Extraction</li>
                <li className="flex items-center gap-2 text-sm font-medium"><BookOpen className="w-4 h-4 text-accent" /> Personal Study Schedule</li>
              </ul>
              <Button className="bg-accent hover:bg-accent/90" asChild>
                <Link href="/student">Access Student Tools</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="py-12 px-6 border-t bg-white">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-2">
            <div className="bg-primary p-2 rounded-lg">
              <Sparkles className="text-white w-4 h-4" />
            </div>
            <span className="font-headline font-bold text-lg text-primary">ScholarMate AI</span>
          </div>
          <div className="text-sm text-muted-foreground">
            © 2024 ScholarMate AI. Built for the future of education.
          </div>
        </div>
      </footer>
    </div>
  );
}
