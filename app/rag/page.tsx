'use client';

import { useState } from 'react';
import { Header } from '@/components/layout/header';
import { DocumentCard } from '@/components/rag/document-card';
import { RagQA } from '@/components/rag/rag-qa';
import { DocumentUpload } from '@/components/rag/document-upload';
import { MOCK_RAG_DOCUMENTS } from '@/lib/mock-data';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function RagPage() {
  const [selectedCategory, setSelectedCategory] = useState('all');

  const filteredDocs =
    selectedCategory === 'all'
      ? MOCK_RAG_DOCUMENTS
      : MOCK_RAG_DOCUMENTS.filter((doc) => doc.category === selectedCategory);

  const categories = ['all', ...new Set(MOCK_RAG_DOCUMENTS.map((doc) => doc.category))];

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      <Header />

      <main className="flex-1 overflow-hidden">
        <div className="h-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-full">
            {/* Left Column - Documents & Upload */}
            <div className="lg:col-span-2 flex flex-col overflow-hidden">
              <Tabs defaultValue="browse" className="w-full flex flex-col overflow-hidden">
                <TabsList className="grid w-full max-w-md grid-cols-2 flex-shrink-0">
                  <TabsTrigger value="browse" className="text-xs sm:text-sm">Browse</TabsTrigger>
                  <TabsTrigger value="upload" className="text-xs sm:text-sm">Upload</TabsTrigger>
                </TabsList>

                {/* Browse Tab */}
                <TabsContent value="browse" className="flex-1 overflow-y-auto mt-4">
                  <div className="space-y-4">
                    {/* Category Filter */}
                    <div className="flex flex-wrap gap-2">
                      {categories.map((category) => (
                        <Badge
                          key={category}
                          variant={selectedCategory === category ? 'default' : 'outline'}
                          className="cursor-pointer capitalize text-xs"
                          onClick={() => setSelectedCategory(category)}
                        >
                          {category === 'all' ? 'All' : category}
                        </Badge>
                      ))}
                    </div>

                    {/* Documents Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {filteredDocs.map((doc) => (
                        <DocumentCard key={doc.id} {...doc} />
                      ))}
                    </div>
                  </div>
                </TabsContent>

                {/* Upload Tab */}
                <TabsContent value="upload" className="flex-1 overflow-y-auto mt-4">
                  <DocumentUpload />
                </TabsContent>
              </Tabs>
            </div>

            {/* Right Column - AI Chat */}
            <div className="lg:col-span-1 flex flex-col overflow-hidden">
              <h2 className="text-base font-semibold text-foreground mb-3 flex-shrink-0">
                AI Assistant
              </h2>
              <div className="flex-1 overflow-hidden">
                <RagQA />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
