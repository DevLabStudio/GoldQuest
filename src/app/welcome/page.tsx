
'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart2, CheckCircle, ShieldCheck, Users, Database, Goal, TrendingUp, Palette, Zap } from 'lucide-react';

const LogoIcon = () => (
  <svg
    width="48"
    height="48"
    viewBox="0 0 100 100"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="text-primary"
  >
    <path d="M75 25 L50 10 L25 25 L25 75 L50 90 L75 75 L75 50 L50 50" stroke="hsl(var(--primary))" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="75" cy="25" r="5" fill="hsl(var(--primary))"/>
    <circle cx="50" cy="10" r="5" fill="hsl(var(--primary))"/>
    <circle cx="25" cy="25" r="5" fill="hsl(var(--primary))"/>
    <circle cx="25" cy="75" r="5" fill="hsl(var(--primary))"/>
    <circle cx="50" cy="90" r="5" fill="hsl(var(--primary))"/>
    <circle cx="75" cy="75" r="5" fill="hsl(var(--primary))"/>
    <circle cx="75" cy="50" r="5" fill="hsl(var(--primary))"/>
    <circle cx="50" cy="50" r="5" fill="hsl(var(--primary))"/>
  </svg>
);


export default function WelcomePage() {
  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground font-sans">
      {/* Header */}
      <header className="py-4 px-4 sm:px-6 lg:px-8 shadow-sm">
        <div className="container mx-auto">
            <nav className="flex justify-between items-center">
            <Link href="/welcome" className="flex items-center gap-2">
                <LogoIcon />
                <span className="text-2xl font-bold text-primary">The Golden Game</span>
            </Link>
            <div className="space-x-2">
                <Link href="/login" passHref>
                <Button variant="outline">Login</Button>
                </Link>
                <Link href="/signup" passHref>
                <Button>Sign Up</Button>
                </Link>
            </div>
            </nav>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-grow">
        <section className="py-20 md:py-28 lg:py-36 text-center bg-gradient-to-b from-background via-muted/10 to-background">
          <div className="container mx-auto px-4">
             <div className="inline-block mb-8 p-3 rounded-full bg-primary/10">
                <LogoIcon />
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-primary mb-6">
              Master Your Finances with The Golden Game
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-3xl mx-auto">
              The all-in-one platform to track accounts, manage expenses, plan budgets, control subscriptions, and achieve your financial goals. Simple, intuitive, and powerful.
            </p>
            <Link href="/signup" passHref>
              <Button size="lg" className="text-lg px-10 py-7 shadow-lg hover:shadow-primary/30 transition-shadow">Get Started Free</Button>
            </Link>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-16 md:py-24 bg-background">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
                <h2 className="text-3xl font-bold text-foreground mb-3">Everything You Need in One Place</h2>
                <p className="text-md text-muted-foreground max-w-2xl mx-auto">Discover the tools that will transform how you manage your money.</p>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              <FeatureCard
                icon={<BarChart2 className="h-8 w-8 text-primary" />}
                title="Comprehensive Tracking"
                description="Monitor all your accounts, transactions, income, and expenses with insightful charts and reports."
              />
              <FeatureCard
                icon={<CheckCircle className="h-8 w-8 text-primary" />}
                title="Smart Budgeting"
                description="Create custom budgets for categories or groups, track your spending, and stay on top of your financial goals."
              />
              <FeatureCard
                icon={<ShieldCheck className="h-8 w-8 text-primary" />}
                title="Secure & Private"
                description="Your financial data is important. We prioritize security with Firebase, ensuring your information is safe."
              />
               <FeatureCard
                icon={<Users className="h-8 w-8 text-primary" />}
                title="Subscription Management"
                description="Never lose track of recurring payments. Manage all your subscriptions and see their impact on your cash flow."
              />
               <FeatureCard
                icon={<Database className="h-8 w-8 text-primary" />}
                title="Data Import & Export"
                description="Easily import data from other services or export your GoldQuest data for backup and peace of mind."
              />
               <FeatureCard
                icon={<Goal className="h-8 w-8 text-primary" />}
                title="Achieve Your Targets"
                description="Set financial targets, track your progress, and make informed decisions to reach your aspirations."
              />
            </div>
          </div>
        </section>
        
        {/* How it Works Section - Placeholder */}
        <section className="py-16 md:py-24 bg-muted/30">
            <div className="container mx-auto px-4 text-center">
                <h2 className="text-3xl font-bold text-foreground mb-3">Simple to Start, Powerful to Use</h2>
                <p className="text-md text-muted-foreground mb-10 max-w-2xl mx-auto">
                    Get up and running in minutes. The Golden Game is designed for clarity and ease of use.
                </p>
                <div className="grid md:grid-cols-3 gap-8 text-left">
                    <StepCard number="1" title="Sign Up Quickly" description="Create your account in under a minute." icon={<Zap className="h-6 w-6 text-primary" />} />
                    <StepCard number="2" title="Add Your Accounts" description="Manually add bank accounts, crypto wallets, and credit cards." icon={<TrendingUp className="h-6 w-6 text-primary" />} />
                    <StepCard number="3" title="Gain Financial Clarity" description="Track, budget, and plan your way to financial mastery." icon={<Palette className="h-6 w-6 text-primary" />} />
                </div>
            </div>
        </section>


        {/* Call to Action Section */}
        <section className="py-20 md:py-28 text-center bg-background">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold text-primary mb-6">Ready to Win The Golden Game of Finance?</h2>
            <p className="text-lg text-muted-foreground mb-10 max-w-2xl mx-auto">
              Take the first step towards financial freedom. It's free to get started!
            </p>
            <Link href="/signup" passHref>
              <Button size="lg" className="text-lg px-10 py-7 shadow-lg hover:shadow-primary/30 transition-shadow">Create Your Free Account</Button>
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="py-10 bg-card text-card-foreground border-t">
        <div className="container mx-auto px-4 text-center">
          <div className="flex justify-center items-center mb-4">
             <LogoIcon />
             <span className="ml-2 text-xl font-semibold text-primary">The Golden Game</span>
          </div>
          <p className="text-sm text-muted-foreground">&copy; {new Date().getFullYear()} The Golden Game. All rights reserved.</p>
          <p className="text-xs text-muted-foreground/80 mt-1">Your Journey to Financial Mastery Starts Here.</p>
        </div>
      </footer>
    </div>
  );
}

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

function FeatureCard({ icon, title, description }: FeatureCardProps) {
  return (
    <Card className="shadow-md hover:shadow-lg transition-shadow duration-300 flex flex-col">
      <CardHeader className="items-center text-center pb-4">
        <div className="p-3 rounded-full bg-primary/10 mb-3 inline-block">
          {icon}
        </div>
        <CardTitle className="text-lg font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="text-center text-sm flex-grow">
        <p className="text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

interface StepCardProps {
  number: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}

function StepCard({ number, title, description, icon }: StepCardProps) {
  return (
    <div className="bg-card p-6 rounded-lg shadow-sm border border-border/50">
      <div className="flex items-center mb-3">
        <div className="flex-shrink-0 h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center mr-4">
          {icon}
        </div>
        <h3 className="text-lg font-semibold text-foreground">{number}. {title}</h3>
      </div>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

