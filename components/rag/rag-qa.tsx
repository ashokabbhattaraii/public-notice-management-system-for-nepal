'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Send, Loader2, Copy, ThumbsUp, ThumbsDown } from 'lucide-react';

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sources?: string[];
}

export function RagQA() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'assistant',
      content:
        'Hello! I\'m your AI document assistant. I can help you find information from our institutional documents. Ask me anything about scholarships, campus facilities, admission procedures, or other academic matters.',
      timestamp: new Date(),
      sources: [],
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // Simulate API call
    setTimeout(() => {
      const mockResponses: Record<string, string> = {
        scholarship:
          'Based on our Financial Aid & Scholarships Guide, we offer merit-based scholarships ranging from Rs. 50,000 to Rs. 2,00,000 per year. Eligibility requires a CGPA of 8.0 or above with no disciplinary records. The application deadline for 2024-25 is April 10, 2024.',
        facilities:
          'According to the Campus Map & Facilities Guide, our institution offers a state-of-the-art library, computer labs, sports complex, hostel facilities, medical center, and a cafeteria. Most facilities are open 24/7 during academic sessions.',
        admission:
          'Our admission process is detailed in the Course Catalog. We offer various undergraduate and postgraduate programs. The general admission timeline is typically from May to July each year.',
        default:
          'I found relevant information in our documents. To get more specific details, please ask about scholarships, facilities, admissions, or course offerings.',
      };

      let response = mockResponses.default;
      const lowerInput = input.toLowerCase();

      if (lowerInput.includes('scholarship') || lowerInput.includes('aid'))
        response = mockResponses.scholarship;
      else if (
        lowerInput.includes('facility') ||
        lowerInput.includes('campus') ||
        lowerInput.includes('hostel')
      )
        response = mockResponses.facilities;
      else if (lowerInput.includes('admission') || lowerInput.includes('apply'))
        response = mockResponses.admission;

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: response,
        timestamp: new Date(),
        sources: ['Financial Aid & Scholarships Guide', 'Student Handbook 2024'],
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setIsLoading(false);
    }, 1000);
  };

  const copyToClipboard = (id: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <Card className="flex flex-col h-full max-h-[600px]">
      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${
                message.type === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className={`max-w-xs lg:max-w-md xl:max-w-lg rounded-lg p-4 ${
                  message.type === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-foreground'
                }`}
              >
                <p className="text-sm">{message.content}</p>

                {message.sources && message.sources.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-current border-opacity-20">
                    <p className="text-xs opacity-75 font-medium mb-2">
                      Sources:
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {message.sources.map((source, idx) => (
                        <Badge
                          key={idx}
                          variant={
                            message.type === 'user'
                              ? 'secondary'
                              : 'outline'
                          }
                          className="text-xs"
                        >
                          {source}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {message.type === 'assistant' && (
                  <div className="flex gap-2 mt-3 pt-3 border-t border-current border-opacity-20">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs"
                      onClick={() =>
                        copyToClipboard(message.id, message.content)
                      }
                    >
                      <Copy className="w-3 h-3" />
                      {copiedId === message.id ? 'Copied' : 'Copy'}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2"
                    >
                      <ThumbsUp className="w-3 h-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2"
                    >
                      <ThumbsDown className="w-3 h-3" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-muted text-foreground rounded-lg p-4">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="border-t border-border p-4">
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <Input
            placeholder="Ask about scholarships, facilities, admissions..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading}
            className="flex-1"
          />
          <Button
            type="submit"
            disabled={isLoading || !input.trim()}
            size="icon"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </form>
      </div>
    </Card>
  );
}
