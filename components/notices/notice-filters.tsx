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
import { Search, X, ChevronDown, ChevronUp } from 'lucide-react';
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
  { value: 'exams', label: 'Exams', icon: '📝' },
  { value: 'vacancies', label: 'Vacancies & Admissions', icon: '💼' },
  { value: 'tenders', label: 'Tenders', icon: '🏢' },
  { value: 'policy', label: 'Policy Updates', icon: '📋' },
  { value: 'announcements', label: 'Announcements', icon: '📢' },
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
    <div className="space-y-4 animate-in fade-in duration-500">
      {/* Main Search Bar - Google Style */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Search notices by title, content, or organization..."
          className="pl-12 pr-4 py-3 rounded-full border border-border/50 focus:border-primary/50 hover:border-border transition-all duration-300 shadow-sm hover:shadow-md focus:shadow-md focus:ring-0"
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

      {/* Filter Chips */}
      <div className="flex flex-wrap gap-2 animate-in fade-in duration-500 delay-100">
        <div className="text-xs font-medium text-muted-foreground">Filter by:</div>
        
        {/* Category Buttons */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => onCategoryChange('all')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 hover:shadow-md ${
              selectedCategory === 'all'
                ? 'bg-primary text-primary-foreground shadow-md'
                : 'bg-muted/50 text-foreground hover:bg-muted'
            }`}
          >
            All
          </button>
          {CATEGORIES.map(cat => (
            <button
              key={cat.value}
              onClick={() => onCategoryChange(cat.value)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 hover:shadow-md flex items-center gap-2 ${
                selectedCategory === cat.value
                  ? 'bg-primary text-primary-foreground shadow-md'
                  : 'bg-muted/50 text-foreground hover:bg-muted'
              }`}
            >
              <span>{cat.icon}</span>
              <span>{cat.label}</span>
            </button>
          ))}
        </div>

        {/* Priority Buttons */}
        <div className="w-full flex flex-wrap gap-2 mt-2 pt-2 border-t border-border">
          <div className="text-xs font-medium text-muted-foreground w-full">Priority:</div>
          <button
            onClick={() => onPriorityChange('all')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 hover:shadow-md ${
              selectedPriority === 'all'
                ? 'bg-primary text-primary-foreground shadow-md'
                : 'bg-muted/50 text-foreground hover:bg-muted'
            }`}
          >
            All
          </button>
          {PRIORITIES.map(pri => (
            <button
              key={pri.value}
              onClick={() => onPriorityChange(pri.value)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 hover:shadow-md ${
                selectedPriority === pri.value
                  ? 'bg-primary text-primary-foreground shadow-md'
                  : 'bg-muted/50 text-foreground hover:bg-muted'
              }`}
            >
              {pri.label}
            </button>
          ))}
        </div>
      </div>

      {/* Clear Filters Button */}
      {hasActiveFilters && (
        <Button
          variant="outline"
          onClick={handleReset}
          className="w-full text-sm transition-all duration-300 hover:bg-destructive/10 hover:text-destructive"
        >
          <X className="w-4 h-4 mr-2" />
          Clear All Filters
        </Button>
      )}
    </div>
  );
}
