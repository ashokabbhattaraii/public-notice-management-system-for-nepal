'use client';

import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Zap, Users, BarChart3, Lock } from 'lucide-react';
import { MOCK_NOTICES, MOCK_RAG_DOCUMENTS } from '@/lib/mock-data';

export default function AboutPage() {
  const features = [
    {
      icon: BarChart3,
      title: 'Smart Notice Management',
      description: 'Browse and filter notices by category, priority, and relevance with powerful search capabilities.',
    },
    {
      icon: Zap,
      title: 'AI-Powered Assistant',
      description: 'Ask questions about institutional documents and get instant, contextual answers from our RAG system.',
    },
    {
      icon: Users,
      title: 'Community Focused',
      description: 'Designed for students, faculty, and administrators to stay connected and informed.',
    },
    {
      icon: Lock,
      title: 'Works Anywhere',
      description: 'Access as a guest or sign in to unlock personalized features like saving notices.',
    },
  ];

  const stats = [
    { label: 'Notices', value: MOCK_NOTICES.length },
    { label: 'Documents', value: MOCK_RAG_DOCUMENTS.length },
    { label: 'Categories', value: 5 },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="border-b border-border bg-card">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
            <h1 className="text-4xl sm:text-5xl font-bold text-foreground mb-4 text-pretty">
              About NoticeBoard
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl">
              Your centralized hub for institutional information, notices, and documents with intelligent document retrieval.
            </p>
          </div>
        </section>

        {/* Stats Section */}
        <section className="border-b border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
              {stats.map((stat, index) => (
                <div key={index} className="text-center">
                  <div className="text-4xl font-bold text-primary mb-2">
                    {stat.value}+
                  </div>
                  <p className="text-muted-foreground">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="border-b border-border bg-muted/30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <h2 className="text-3xl font-bold text-foreground mb-12 text-center">
              Powerful Features
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {features.map((feature, index) => {
                const Icon = feature.icon;
                return (
                  <Card key={index} className="p-6">
                    <div className="flex gap-4">
                      <div className="flex-shrink-0">
                        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                          <Icon className="h-6 w-6 text-primary" />
                        </div>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-foreground mb-2">
                          {feature.title}
                        </h3>
                        <p className="text-muted-foreground text-sm">
                          {feature.description}
                        </p>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="border-b border-border">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <h2 className="text-3xl font-bold text-foreground mb-8 text-center">
              How It Works
            </h2>
            <div className="space-y-6">
              {[
                {
                  step: '1',
                  title: 'Browse Notices',
                  description: 'Explore institutional notices across multiple categories. Search, filter by priority, and find exactly what you need.',
                },
                {
                  step: '2',
                  title: 'Access Documents',
                  description: 'Download official institutional documents including handbooks, guides, and academic catalogs.',
                },
                {
                  step: '3',
                  title: 'Ask Questions',
                  description: 'Use our AI-powered assistant to ask questions about documents and get instant, contextual answers.',
                },
                {
                  step: '4',
                  title: 'Stay Informed',
                  description: 'Sign in to save your favorite notices and personalize your experience across the platform.',
                },
              ].map((item, index) => (
                <div key={index} className="flex gap-6">
                  <div className="flex-shrink-0">
                    <Badge className="h-10 w-10 flex items-center justify-center text-base">
                      {item.step}
                    </Badge>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-foreground mb-2">
                      {item.title}
                    </h3>
                    <p className="text-muted-foreground">
                      {item.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Tech Stack */}
        <section className="bg-muted/30">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <h2 className="text-3xl font-bold text-foreground mb-8 text-center">
              Built With Modern Tech
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {[
                'Next.js 16',
                'React 19',
                'TypeScript',
                'Tailwind CSS',
                'shadcn/ui',
                'Lucide Icons',
                'Context API',
                'localStorage',
              ].map((tech, index) => (
                <div
                  key={index}
                  className="flex items-center justify-center p-4 border border-border rounded-lg bg-card hover:bg-muted transition"
                >
                  <span className="text-sm font-medium text-foreground text-center">
                    {tech}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
