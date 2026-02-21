'use client';

import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Zap, Users, BarChart3, Lock } from 'lucide-react';
import { MOCK_NOTICES, MOCK_RAG_DOCUMENTS } from '@/lib/mock-data';
import { useLanguage } from '@/lib/language-context';

export default function AboutPage() {
  const { t } = useLanguage();

  const features = [
    {
      icon: BarChart3,
      title: t('about.feature1Title'),
      description: t('about.feature1Desc'),
    },
    {
      icon: Zap,
      title: t('about.feature2Title'),
      description: t('about.feature2Desc'),
    },
    {
      icon: Users,
      title: t('about.feature3Title'),
      description: t('about.feature3Desc'),
    },
    {
      icon: Lock,
      title: t('about.feature4Title'),
      description: t('about.feature4Desc'),
    },
  ];

  const stats = [
    { label: t('about.notices'), value: MOCK_NOTICES.length },
    { label: t('about.documents'), value: MOCK_RAG_DOCUMENTS.length },
    { label: t('about.categories'), value: 5 },
  ];

  const steps = [
    { step: '1', title: t('about.step1Title'), description: t('about.step1Desc') },
    { step: '2', title: t('about.step2Title'), description: t('about.step2Desc') },
    { step: '3', title: t('about.step3Title'), description: t('about.step3Desc') },
    { step: '4', title: t('about.step4Title'), description: t('about.step4Desc') },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="border-b border-border bg-card">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
            <h1 className="text-4xl sm:text-5xl font-bold text-foreground mb-4 text-pretty">
              {t('about.title')}
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl">
              {t('about.subtitle')}
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
              {t('about.powerfulFeatures')}
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
              {t('about.howItWorks')}
            </h2>
            <div className="space-y-6">
              {steps.map((item, index) => (
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
              {t('about.builtWith')}
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
