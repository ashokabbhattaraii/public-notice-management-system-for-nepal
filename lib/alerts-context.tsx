'use client';

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { MOCK_NOTICES, type Notice } from '@/lib/mock-data';

export interface AlertRule {
  id: string;
  name: string;
  categories: string[];
  organizations: string[];
  priorities: string[];
  keywords: string;
  enabled: boolean;
  createdAt: Date;
}

interface AlertsContextType {
  alerts: AlertRule[];
  addAlert: (alert: Omit<AlertRule, 'id' | 'createdAt'>) => void;
  updateAlert: (id: string, alert: Partial<AlertRule>) => void;
  deleteAlert: (id: string) => void;
  toggleAlert: (id: string) => void;
  getMatchingNotices: (alert: AlertRule) => Notice[];
  getAllMatchedNotices: () => Notice[];
  matchedCount: number;
}

const AlertsContext = createContext<AlertsContextType | undefined>(undefined);

const STORAGE_KEY = 'notice-alert-rules';

function generateId() {
  return `alert_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function doesNoticeMatchRule(notice: Notice, rule: AlertRule): boolean {
  if (!rule.enabled) return false;

  const matchesCategory =
    rule.categories.length === 0 || rule.categories.includes(notice.category);

  const matchesOrganization =
    rule.organizations.length === 0 ||
    rule.organizations.some((org) =>
      notice.organization.toLowerCase().includes(org.toLowerCase())
    );

  const matchesPriority =
    rule.priorities.length === 0 || rule.priorities.includes(notice.priority);

  const matchesKeywords =
    !rule.keywords.trim() ||
    rule.keywords
      .split(',')
      .map((k) => k.trim().toLowerCase())
      .filter(Boolean)
      .some(
        (keyword) =>
          notice.title.toLowerCase().includes(keyword) ||
          notice.description.toLowerCase().includes(keyword) ||
          notice.content.toLowerCase().includes(keyword)
      );

  return matchesCategory && matchesOrganization && matchesPriority && matchesKeywords;
}

export function AlertsProvider({ children }: { children: ReactNode }) {
  const [alerts, setAlerts] = useState<AlertRule[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setAlerts(
          parsed.map((a: AlertRule) => ({ ...a, createdAt: new Date(a.createdAt) }))
        );
      }
    } catch {
      // ignore
    }
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(alerts));
    }
  }, [alerts, mounted]);

  const addAlert = useCallback((alert: Omit<AlertRule, 'id' | 'createdAt'>) => {
    setAlerts((prev) => [
      ...prev,
      { ...alert, id: generateId(), createdAt: new Date() },
    ]);
  }, []);

  const updateAlert = useCallback((id: string, partial: Partial<AlertRule>) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, ...partial } : a))
    );
  }, []);

  const deleteAlert = useCallback((id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const toggleAlert = useCallback((id: string) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, enabled: !a.enabled } : a))
    );
  }, []);

  const getMatchingNotices = useCallback((alert: AlertRule): Notice[] => {
    return MOCK_NOTICES.filter((n) => doesNoticeMatchRule(n, alert));
  }, []);

  const getAllMatchedNotices = useCallback((): Notice[] => {
    const activeAlerts = alerts.filter((a) => a.enabled);
    if (activeAlerts.length === 0) return [];
    const matchedIds = new Set<string>();
    const matched: Notice[] = [];
    for (const notice of MOCK_NOTICES) {
      for (const rule of activeAlerts) {
        if (doesNoticeMatchRule(notice, rule)) {
          if (!matchedIds.has(notice.id)) {
            matchedIds.add(notice.id);
            matched.push(notice);
          }
          break;
        }
      }
    }
    return matched;
  }, [alerts]);

  const matchedCount = mounted ? getAllMatchedNotices().length : 0;

  return (
    <AlertsContext.Provider
      value={{
        alerts,
        addAlert,
        updateAlert,
        deleteAlert,
        toggleAlert,
        getMatchingNotices,
        getAllMatchedNotices,
        matchedCount,
      }}
    >
      {children}
    </AlertsContext.Provider>
  );
}

export function useAlerts() {
  const ctx = useContext(AlertsContext);
  if (!ctx) throw new Error('useAlerts must be used within AlertsProvider');
  return ctx;
}

export { doesNoticeMatchRule };
