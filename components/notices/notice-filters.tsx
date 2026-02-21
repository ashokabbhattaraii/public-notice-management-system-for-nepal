'use client';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Card } from '@/components/ui/card';
import { Search, X, GraduationCap, Briefcase, FileCheck, FileText, Megaphone, AlertCircle } from 'lucide-react';
import { useState } from 'react';

interface NoticeFiltersProps {
  onSearch: (query: string) => void;
  onCategoryChange: (category: string) => void;
  onPriorityChange: (priority: string) => void;
  selectedCategory: string;
  selectedPriority: string;
  searchQuery: string;
}

const CATEGORIES = [
  { value: 'exams', label: 'Exams', Icon: GraduationCap },
  { value: 'vacancies', label: 'Vacancies', Icon: Briefcase },
  { value: 'tenders', label: 'Tenders', Icon: FileCheck },
  { value: 'policy', label: 'Policy Updates', Icon: FileText },
  { value: 'announcements', label: 'Announcements', Icon: Megaphone },
];

const PRIORITIES = [
  { value: 'high', label: 'High Priority', color: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' },
  { value: 'normal', label: 'Normal', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
  { value: 'low', label: 'Low Priority', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
];

export function NoticeFilters({
  onSearch,
  onCategoryChange,
  onPriorityChange,
  selectedCategory,
  selectedPriority,
  searchQuery,
}: NoticeFiltersProps) {
  const [localSearch, setLocalSearch] = useState(searchQuery);
  const [expandedSections, setExpandedSections] = useState({
    search: true,
    category: true,
    priority: true,
  });

  const handleSearchChange = (value: string) => {
    setLocalSearch(value);
    onSearch(value);
  };

  const handleReset = () => {
    setLocalSearch('');
    onSearch('');
    onCategoryChange('all');
    onPriorityChange('all');
  };

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const hasActiveFilters = selectedCategory !== 'all' || selectedPriority !== 'all' || searchQuery;

  return (
    <div className="space-y-4">
      {/* Main Search Bar */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Search notices by title, content, or organization..."
          className="pl-12 pr-4 py-3 h-12 rounded-lg border-border/60 focus:border-primary/50 transition-all"
          value={localSearch}
          onChange={(e) => handleSearchChange(e.target.value)}
        />
        {localSearch && (
          <button
            onClick={() => handleSearchChange('')}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Filter Section */}
      <div className="space-y-3">
        {/* Category Filters */}
        <div>
          <label className="text-sm font-medium text-foreground mb-2.5 block">Category</label>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={selectedCategory === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onCategoryChange('all')}
              className="h-9 rounded-lg"
            >
              All Categories
            </Button>
            {CATEGORIES.map(cat => {
              const Icon = cat.Icon;
              return (
                <Button
                  key={cat.value}
                  variant={selectedCategory === cat.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => onCategoryChange(cat.value)}
                  className="h-9 rounded-lg gap-2"
                >
                  <Icon className="w-4 h-4" />
                  <span>{cat.label}</span>
                </Button>
              );
            })}
          </div>
        </div>

        {/* Priority Filters */}
        <div>
          <label className="text-sm font-medium text-foreground mb-2.5 block">Priority</label>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={selectedPriority === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onPriorityChange('all')}
              className="h-9 rounded-lg"
            >
              All Priorities
            </Button>
            {PRIORITIES.map(pri => (
              <Button
                key={pri.value}
                variant={selectedPriority === pri.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => onPriorityChange(pri.value)}
                className="h-9 rounded-lg capitalize"
              >
                <AlertCircle className="w-4 h-4 mr-1.5" />
                {pri.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Clear Filters */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          onClick={handleReset}
          className="w-full text-sm hover:bg-muted"
        >
          <X className="w-4 h-4 mr-2" />
          Clear All Filters
        </Button>
      )}
    </div>
  );
}
