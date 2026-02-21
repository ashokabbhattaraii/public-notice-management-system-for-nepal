export interface ScrapingTask {
  id: string;
  source: string;
  url: string;
  status: 'active' | 'paused' | 'error' | 'completed';
  lastRun: Date;
  nextRun: Date;
  successRate: number;
  noticesScraped: number;
  errors: number;
}

export interface NoticeModeration {
  id: string;
  title: string;
  source: string;
  status: 'pending' | 'approved' | 'rejected' | 'duplicate';
  scrapedDate: Date;
  confidence: number;
  category: string;
  isDuplicate?: boolean;
  duplicateOf?: string;
}

export interface CategoryConfig {
  id: string;
  name: string;
  slug: string;
  description: string;
  aiKeywords: string[];
  color: string;
  enabled: boolean;
  noticeCount: number;
}

export interface SystemUser {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
  status: 'active' | 'suspended';
  lastLogin: Date;
  createdAt: Date;
  noticesSaved: number;
}

export interface SystemLog {
  id: string;
  timestamp: Date;
  level: 'info' | 'warning' | 'error';
  message: string;
  source: string;
  details?: string;
}

export interface SystemHealth {
  cpu: number;
  memory: number;
  disk: number;
  activeScrapers: number;
  queuedTasks: number;
  errorRate: number;
}

export const MOCK_SCRAPING_TASKS: ScrapingTask[] = [
  {
    id: '1',
    source: 'Public Service Commission',
    url: 'https://psc.gov.np',
    status: 'active',
    lastRun: new Date(Date.now() - 1000 * 60 * 30),
    nextRun: new Date(Date.now() + 1000 * 60 * 30),
    successRate: 98.5,
    noticesScraped: 1250,
    errors: 12,
  },
  {
    id: '2',
    source: 'Tribhuvan University',
    url: 'https://tu.edu.np',
    status: 'active',
    lastRun: new Date(Date.now() - 1000 * 60 * 45),
    nextRun: new Date(Date.now() + 1000 * 60 * 15),
    successRate: 95.2,
    noticesScraped: 890,
    errors: 35,
  },
  {
    id: '3',
    source: 'Ministry of Education',
    url: 'https://moe.gov.np',
    status: 'error',
    lastRun: new Date(Date.now() - 1000 * 60 * 120),
    nextRun: new Date(Date.now() + 1000 * 60 * 5),
    successRate: 76.8,
    noticesScraped: 445,
    errors: 89,
  },
  {
    id: '4',
    source: 'Nepal Rastra Bank',
    url: 'https://nrb.org.np',
    status: 'paused',
    lastRun: new Date(Date.now() - 1000 * 60 * 60 * 24),
    nextRun: new Date(Date.now() + 1000 * 60 * 60),
    successRate: 92.3,
    noticesScraped: 320,
    errors: 18,
  },
];

export const MOCK_MODERATION_NOTICES: NoticeModeration[] = [
  {
    id: '1',
    title: 'Open Competition Examination Notice for Various Positions',
    source: 'Public Service Commission',
    status: 'pending',
    scrapedDate: new Date(Date.now() - 1000 * 60 * 15),
    confidence: 92,
    category: 'vacancies',
  },
  {
    id: '2',
    title: 'Scholarship Application for Graduate Studies',
    source: 'University Grants Commission',
    status: 'pending',
    scrapedDate: new Date(Date.now() - 1000 * 60 * 30),
    confidence: 88,
    category: 'announcements',
  },
  {
    id: '3',
    title: 'Annual Examination Schedule 2024',
    source: 'Tribhuvan University',
    status: 'duplicate',
    scrapedDate: new Date(Date.now() - 1000 * 60 * 45),
    confidence: 76,
    category: 'exams',
    isDuplicate: true,
    duplicateOf: 'Annual Exam 2024 - TU',
  },
  {
    id: '4',
    title: 'Tender Notice for Infrastructure Development',
    source: 'Ministry of Urban Development',
    status: 'approved',
    scrapedDate: new Date(Date.now() - 1000 * 60 * 60),
    confidence: 95,
    category: 'tenders',
  },
];

export const MOCK_CATEGORIES: CategoryConfig[] = [
  {
    id: '1',
    name: 'Exams',
    slug: 'exams',
    description: 'Examination schedules, results, and related notices',
    aiKeywords: ['exam', 'examination', 'test', 'result', 'marks', 'grade'],
    color: '#3b82f6',
    enabled: true,
    noticeCount: 234,
  },
  {
    id: '2',
    name: 'Vacancies & Admissions',
    slug: 'vacancies',
    description: 'Job openings, recruitment, and admission notices',
    aiKeywords: ['vacancy', 'job', 'recruitment', 'admission', 'apply', 'position'],
    color: '#10b981',
    enabled: true,
    noticeCount: 456,
  },
  {
    id: '3',
    name: 'Tenders',
    slug: 'tenders',
    description: 'Government and institutional tender announcements',
    aiKeywords: ['tender', 'bid', 'procurement', 'contract', 'proposal'],
    color: '#f59e0b',
    enabled: true,
    noticeCount: 189,
  },
  {
    id: '4',
    name: 'Policy Updates',
    slug: 'policy',
    description: 'Policy changes, regulations, and official guidelines',
    aiKeywords: ['policy', 'regulation', 'guideline', 'law', 'act', 'amendment'],
    color: '#8b5cf6',
    enabled: true,
    noticeCount: 123,
  },
  {
    id: '5',
    name: 'Announcements',
    slug: 'announcements',
    description: 'General announcements and public notices',
    aiKeywords: ['announce', 'notice', 'information', 'update', 'alert'],
    color: '#ec4899',
    enabled: true,
    noticeCount: 567,
  },
];

export const MOCK_SYSTEM_USERS: SystemUser[] = [
  {
    id: '1',
    name: 'John Doe',
    email: 'john@example.com',
    role: 'user',
    status: 'active',
    lastLogin: new Date(Date.now() - 1000 * 60 * 30),
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30),
    noticesSaved: 45,
  },
  {
    id: '2',
    name: 'Admin Demo',
    email: 'admin@demo.com',
    role: 'admin',
    status: 'active',
    lastLogin: new Date(Date.now() - 1000 * 60 * 5),
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 180),
    noticesSaved: 12,
  },
  {
    id: '3',
    name: 'Jane Smith',
    email: 'jane@example.com',
    role: 'user',
    status: 'active',
    lastLogin: new Date(Date.now() - 1000 * 60 * 60 * 2),
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 15),
    noticesSaved: 23,
  },
  {
    id: '4',
    name: 'Bob Wilson',
    email: 'bob@example.com',
    role: 'user',
    status: 'suspended',
    lastLogin: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5),
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 60),
    noticesSaved: 8,
  },
];

export const MOCK_SYSTEM_LOGS: SystemLog[] = [
  {
    id: '1',
    timestamp: new Date(Date.now() - 1000 * 60 * 5),
    level: 'info',
    message: 'Scraping completed successfully',
    source: 'Public Service Commission',
    details: '15 new notices scraped',
  },
  {
    id: '2',
    timestamp: new Date(Date.now() - 1000 * 60 * 15),
    level: 'warning',
    message: 'High CPU usage detected',
    source: 'System Monitor',
    details: 'CPU usage at 87%',
  },
  {
    id: '3',
    timestamp: new Date(Date.now() - 1000 * 60 * 30),
    level: 'error',
    message: 'Failed to connect to source',
    source: 'Ministry of Education',
    details: 'Connection timeout after 30s',
  },
  {
    id: '4',
    timestamp: new Date(Date.now() - 1000 * 60 * 45),
    level: 'info',
    message: 'Duplicate notice detected and merged',
    source: 'Deduplication Service',
    details: 'Notice ID: 12345',
  },
];

export const MOCK_SYSTEM_HEALTH: SystemHealth = {
  cpu: 45,
  memory: 62,
  disk: 38,
  activeScrapers: 4,
  queuedTasks: 12,
  errorRate: 2.3,
};
