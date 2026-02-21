'use client';

import { useState } from 'react';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { DocumentCard } from '@/components/rag/document-card';
import { RagQA } from '@/components/rag/rag-qa';
import { MOCK_RAG_DOCUMENTS } from '@/lib/mock-data';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Upload, BookOpen, Lightbulb } from 'lucide-react';

export default function RagPage() {
  const [selectedCategory, setSelectedCategory] = useState('all');

  const filteredDocs =
    selectedCategory === 'all'
      ? MOCK_RAG_DOCUMENTS
      : MOCK_RAG_DOCUMENTS.filter((doc) => doc.category === selectedCategory);

  const categories = ['all', ...new Set(MOCK_RAG_DOCUMENTS.map((doc) => doc.category))];

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="border-b border-border bg-card">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-2 text-pretty">
                  Documents & AI Assistant
                </h1>
                <p className="text-muted-foreground text-lg max-w-2xl">
                  Browse institutional documents and ask our AI assistant questions about scholarships, facilities, admissions, and more.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column - Documents */}
            <div className="lg:col-span-2 space-y-6">
              {/* Info Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Card className="p-4 border border-primary/20 bg-primary/5">
                  <div className="flex items-start gap-3">
                    <BookOpen className="w-6 h-6 text-primary flex-shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-semibold text-foreground mb-1">
                        {MOCK_RAG_DOCUMENTS.length} Documents
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Browse and download official institutional documents
                      </p>
                    </div>
                  </div>
                </Card>

                <Card className="p-4 border border-accent/20 bg-accent/5">
                  <div className="flex items-start gap-3">
                    <Lightbulb className="w-6 h-6 text-accent flex-shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-semibold text-foreground mb-1">
                        AI-Powered Search
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Ask questions and get instant answers from documents
                      </p>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Category Filter */}
              <div>
                <h2 className="text-lg font-semibold text-foreground mb-3">
                  Documents
                </h2>
                <div className="flex flex-wrap gap-2 mb-6">
                  {categories.map((category) => (
                    <Badge
                      key={category}
                      variant={selectedCategory === category ? 'default' : 'outline'}
                      className="cursor-pointer capitalize"
                      onClick={() => setSelectedCategory(category)}
                    >
                      {category === 'all' ? 'All Documents' : category}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Documents Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {filteredDocs.map((doc) => (
                  <DocumentCard key={doc.id} {...doc} />
                ))}
              </div>
            </div>

            {/* Right Column - AI Chat */}
            <div className="lg:col-span-1">
              <div className="sticky top-20">
                <h2 className="text-lg font-semibold text-foreground mb-4">
                  Ask a Question
                </h2>
                <RagQA />
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
