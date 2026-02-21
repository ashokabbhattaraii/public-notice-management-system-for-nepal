'use client';

import { useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, X, FileText, Check } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  embedded: boolean;
}

export function DocumentUpload() {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    addFiles(droppedFiles);
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      addFiles(selectedFiles);
    }
  }, []);

  const addFiles = (newFiles: File[]) => {
    const uploadedFiles: UploadedFile[] = newFiles.map((file) => ({
      id: Date.now().toString() + Math.random().toString(),
      name: file.name,
      size: file.size,
      type: file.type,
      embedded: false,
    }));

    setFiles((prev) => [...prev, ...uploadedFiles]);

    // Store in localStorage
    const stored = localStorage.getItem('rag-documents');
    const existing = stored ? JSON.parse(stored) : [];
    localStorage.setItem('rag-documents', JSON.stringify([...existing, ...uploadedFiles]));
  };

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));

    // Update localStorage
    const stored = localStorage.getItem('rag-documents');
    if (stored) {
      const existing = JSON.parse(stored);
      const updated = existing.filter((f: UploadedFile) => f.id !== id);
      localStorage.setItem('rag-documents', JSON.stringify(updated));
    }
  };

  const toggleEmbed = (id: string) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, embedded: !f.embedded } : f))
    );

    // Update localStorage
    const stored = localStorage.getItem('rag-documents');
    if (stored) {
      const existing = JSON.parse(stored);
      const updated = existing.map((f: UploadedFile) =>
        f.id === id ? { ...f, embedded: !f.embedded } : f
      );
      localStorage.setItem('rag-documents', JSON.stringify(updated));
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      <Card
        className={`border-2 border-dashed transition-colors ${
          isDragging
            ? 'border-primary bg-primary/5'
            : 'border-border hover:border-primary/50'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <label className="flex flex-col items-center justify-center p-8 cursor-pointer">
          <Upload className={`w-12 h-12 mb-3 ${isDragging ? 'text-primary' : 'text-muted-foreground'}`} />
          <p className="text-sm font-medium text-foreground mb-1">
            Drop files here or click to upload
          </p>
          <p className="text-xs text-muted-foreground">
            PDF, DOC, DOCX, TXT up to 10MB
          </p>
          <input
            type="file"
            className="hidden"
            multiple
            accept=".pdf,.doc,.docx,.txt"
            onChange={handleFileSelect}
          />
        </label>
      </Card>

      {/* Uploaded Files */}
      {files.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground">
            Uploaded Documents ({files.length})
          </h3>
          <div className="space-y-2">
            {files.map((file) => (
              <Card key={file.id} className="p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <FileText className="w-5 h-5 text-primary flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {file.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(file.size)}
                      </p>
                    </div>
                    {file.embedded && (
                      <Badge variant="default" className="flex-shrink-0">
                        <Check className="w-3 h-3 mr-1" />
                        Embedded
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant={file.embedded ? 'secondary' : 'default'}
                      onClick={() => toggleEmbed(file.id)}
                    >
                      {file.embedded ? 'Unembed' : 'Embed'}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeFile(file.id)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
