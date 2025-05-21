
'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart2, Users, Database, Goal, Map, Gem, Shield, BookOpen, Zap, TrendingUp } from 'lucide-react'; // Removed Palette as it's not used, kept others

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

export default function WelcomePage() {
  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground font-sans">
      {/* Header */}
      <header className="py-4 px-4 sm:px-6 lg:px-8 shadow-sm">
        <div className="container mx-auto">
            <nav className="flex justify-between items-center">
            <Link href="/welcome" className="flex items-center gap-2">
                <LogoIcon />
                <span className="text-2xl font-bold text-primary">GoldQuest</span>
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
              Embark on Your GoldQuest to Financial Freedom!
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-3xl mx-auto">
              Your all-in-one treasure map to track accounts, conquer expenses, forge budgets, and achieve legendary financial goals. Simple, intuitive, and empowering.
            </p>
            <Link href="/signup" passHref>
              <Button size="lg" className="text-lg px-10 py-7 shadow-lg hover:shadow-primary/30 transition-shadow">Begin Your Quest - Free!</Button>
            </Link>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-16 md:py-24 bg-background">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
                <h2 className="text-3xl font-bold text-foreground mb-3">Your Arsenal for the Financial Frontier</h2>
                <p className="text-md text-muted-foreground max-w-2xl mx-auto">Discover the legendary tools that will transform your wealth-building journey.</p>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              <FeatureCard
                icon={<Map className="h-8 w-8 text-primary" />}
                title="Chart Your Financial Map"
                description="Navigate all your accounts, transactions, income, and expenses with insightful charts and reports. Know where your gold flows."
              />
              <FeatureCard
                icon={<Goal className="h-8 w-8 text-primary" />}
                title="Forge Powerful Budgets"
                description="Craft custom budgets for categories or groups, track your spending, and stay on course to conquer your financial milestones."
              />
              <FeatureCard
                icon={<Shield className="h-8 w-8 text-primary" />}
                title="Fortified & Private Vault"
                description="Your financial treasures are sacred. We prioritize security with Firebase, ensuring your information is heavily guarded."
              />
               <FeatureCard
                icon={<Users className="h-8 w-8 text-primary" />}
                title="Master Your Guild Subscriptions"
                description="Never lose track of recurring tributes. Manage all your subscriptions and see their impact on your treasure chest."
              />
               <FeatureCard
                icon={<Database className="h-8 w-8 text-primary" />}
                title="Ancient Scrolls: Import & Export"
                description="Easily import lore from other realms (services) or export your GoldQuest saga for backup and peace of mind."
              />
               <FeatureCard
                icon={<Gem className="h-8 w-8 text-primary" />}
                title="Claim Your Financial Destiny"
                description="Set legendary targets, track your epic progress, and make wise decisions to reach your financial aspirations."
              />
            </div>
          </div>
        </section>
        
        <section className="py-16 md:py-24 bg-muted/30">
            <div className="container mx-auto px-4 text-center">
                <h2 className="text-3xl font-bold text-foreground mb-3">Begin Your Adventure in Minutes</h2>
                <p className="text-md text-muted-foreground mb-10 max-w-2xl mx-auto">
                    GoldQuest is designed for clarity and ease of use. Your path to financial mastery is clear.
                </p>
                <div className="grid md:grid-cols-3 gap-8 text-left">
                    <StepCard number="1" title="Quick Start Your Quest" description="Create your hero profile (account) in under a minute." icon={<Zap className="h-6 w-6 text-primary" />} />
                    <StepCard number="2" title="Map Your Territories" description="Manually add your treasure troves: bank accounts, crypto wallets, and credit cards." icon={<TrendingUp className="h-6 w-6 text-primary" />} />
                    <StepCard number="3" title="Achieve Financial Legend Status" description="Track, budget, and plan your way to becoming a financial legend." icon={<BookOpen className="h-6 w-6 text-primary" />} />
                </div>
            </div>
        </section>

        {/* Call to Action Section */}
        <section className="py-20 md:py-28 text-center bg-background">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold text-primary mb-6">Ready to Claim Your Financial Riches?</h2>
            <p className="text-lg text-muted-foreground mb-10 max-w-2xl mx-auto">
              Take the first step on your GoldQuest. It's free to start your epic journey!
            </p>
            <Link href="/signup" passHref>
              <Button size="lg" className="text-lg px-10 py-7 shadow-lg hover:shadow-primary/30 transition-shadow">Create Your Free Account & Begin!</Button>
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="py-10 bg-card text-card-foreground border-t">
        <div className="container mx-auto px-4 text-center">
          <div className="flex justify-center items-center mb-4">
             <LogoIcon />
             <span className="ml-2 text-xl font-semibold text-primary">GoldQuest</span>
          </div>
          <p className="text-sm text-muted-foreground">&copy; {new Date().getFullYear()} GoldQuest. All rights reserved.</p>
          <p className="text-xs text-muted-foreground/80 mt-1">Your Epic Journey to Financial Mastery Starts Here.</p>
        </div>
      </footer>
    </div>
  );
}
    