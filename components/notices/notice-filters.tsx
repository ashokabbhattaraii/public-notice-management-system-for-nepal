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
import { Search, X } from 'lucide-react';
import { useState } from 'react';

interface NoticeFiltersProps {
  onSearch: (query: string) => void;
  onCategoryChange: (category: string) => void;
  onPriorityChange: (priority: string) => void;
  selectedCategory: string;
  selectedPriority: string;
  searchQuery: string;
}

export function NoticeFilters({
  onSearch,
  onCategoryChange,
  onPriorityChange,
  selectedCategory,
  selectedPriority,
  searchQuery,
}: NoticeFiltersProps) {
  const [localSearch, setLocalSearch] = useState(searchQuery);

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

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <Input
          placeholder="Search notices by title, description..."
          className="pl-10"
          value={localSearch}
          onChange={(e) => handleSearchChange(e.target.value)}
        />
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Category Filter */}
        <Select value={selectedCategory} onValueChange={onCategoryChange}>
          <SelectTrigger>
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="exams">Exams</SelectItem>
            <SelectItem value="vacancies">Vacancies</SelectItem>
            <SelectItem value="tenders">Tenders</SelectItem>
            <SelectItem value="policy">Policy</SelectItem>
            <SelectItem value="announcements">Announcements</SelectItem>
          </SelectContent>
        </Select>

        {/* Priority Filter */}
        <Select value={selectedPriority} onValueChange={onPriorityChange}>
          <SelectTrigger>
            <SelectValue placeholder="All Priorities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            <SelectItem value="high">High Priority</SelectItem>
            <SelectItem value="normal">Normal</SelectItem>
            <SelectItem value="low">Low Priority</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Reset Button */}
      {(selectedCategory !== 'all' || selectedPriority !== 'all' || searchQuery) && (
        <Button
          variant="outline"
          onClick={handleReset}
          className="w-full"
        >
          <X className="w-4 h-4 mr-2" />
          Clear Filters
        </Button>
      )}
    </div>
  );
}
