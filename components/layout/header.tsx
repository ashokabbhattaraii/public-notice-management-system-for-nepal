'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Bell, Menu, X, LogOut, User as UserIcon, Moon, Sun, Globe, FileText } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from 'next-themes';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';

export function Header() {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [language, setLanguage] = useState('en');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 hover:opacity-90 transition group">
            <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary/80 rounded-lg flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div className="hidden sm:block">
              <span className="font-bold text-lg text-foreground block leading-tight">Nepal Notices</span>
              <span className="text-xs text-muted-foreground font-medium">Government Hub</span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex gap-8 items-center">
            <Link href="/" className="text-sm text-foreground hover:text-primary transition">
              Notices
            </Link>
            <Link href="/rag" className="text-sm text-foreground hover:text-primary transition">
              Documents
            </Link>
            <Link href="/about" className="text-sm text-foreground hover:text-primary transition">
              About
            </Link>
          </nav>

          {/* Right Section */}
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Theme Toggle */}
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="hover:bg-muted transition-colors h-9 w-9"
            >
              {mounted && theme === 'dark' ? (
                <Sun className="w-[18px] h-[18px]" />
              ) : (
                <Moon className="w-[18px] h-[18px]" />
              )}
            </Button>

            {/* Language Switch */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="hover:bg-muted transition-colors h-9 w-9">
                  <Globe className="w-[18px] h-[18px]" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuCheckboxItem 
                  checked={language === 'en'}
                  onCheckedChange={() => setLanguage('en')}
                >
                  English
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem 
                  checked={language === 'ne'}
                  onCheckedChange={() => setLanguage('ne')}
                >
                  नेपाली
                </DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Notifications */}
            <Button variant="ghost" size="icon" className="relative hover:bg-muted transition-colors h-9 w-9">
              <Bell className="w-[18px] h-[18px]" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-background" />
            </Button>

            {/* Auth Menu */}
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-2">
                    <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold">
                      {user.name.charAt(0)}
                    </div>
                    <span className="hidden sm:inline text-sm">{user.name}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem disabled className="text-xs text-muted-foreground">
                    {user.email}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>
                    <UserIcon className="w-4 h-4 mr-2" />
                    <span>Profile</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <span>Saved Items</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={logout} className="text-destructive">
                    <LogOut className="w-4 h-4 mr-2" />
                    <span>Logout</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="hidden sm:flex gap-2">
                <Button variant="outline" size="sm">
                  <Link href="/login">Login</Link>
                </Button>
                <Button size="sm">
                  <Link href="/signup">Sign Up</Link>
                </Button>
              </div>
            )}

            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden pb-4 border-t border-border">
            <Link href="/" className="block py-2 text-sm text-foreground hover:text-primary">
              Notices
            </Link>
            <Link href="/rag" className="block py-2 text-sm text-foreground hover:text-primary">
              Documents
            </Link>
            <Link href="/about" className="block py-2 text-sm text-foreground hover:text-primary">
              About
            </Link>
            {!user && (
              <div className="flex gap-2 mt-4">
                <Button variant="outline" size="sm" className="flex-1">
                  <Link href="/login">Login</Link>
                </Button>
                <Button size="sm" className="flex-1">
                  <Link href="/signup">Sign Up</Link>
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
