export const SAVED_NOTICES = [
  {
    id: '1',
    title: 'Nepal Engineering Entrance Examination 2024',
    category: 'exams',
    savedDate: new Date('2024-02-15'),
    deadline: new Date('2024-03-30'),
  },
  {
    id: '2',
    title: 'Government Scholarship Program for Undergraduate Students',
    category: 'vacancies',
    savedDate: new Date('2024-02-10'),
    deadline: new Date('2024-04-15'),
  },
  {
    id: '3',
    title: 'Public Service Commission - Various Positions',
    category: 'vacancies',
    savedDate: new Date('2024-02-08'),
    deadline: new Date('2024-03-20'),
  },
];

export const RECENT_ACTIVITY = [
  {
    id: '1',
    action: 'Viewed',
    title: 'Nepal Engineering Entrance Examination 2024',
    timestamp: new Date('2024-02-20T10:30:00'),
  },
  {
    id: '2',
    action: 'Saved',
    title: 'Government Scholarship Program',
    timestamp: new Date('2024-02-19T14:20:00'),
  },
  {
    id: '3',
    action: 'Downloaded',
    title: 'Student Handbook 2024',
    timestamp: new Date('2024-02-18T09:15:00'),
  },
  {
    id: '4',
    action: 'Asked Question',
    title: 'How to apply for scholarships?',
    timestamp: new Date('2024-02-17T16:45:00'),
  },
];

export const SUBSCRIBED_CATEGORIES = [
  { name: 'exams', count: 12, enabled: true },
  { name: 'vacancies', count: 8, enabled: true },
  { name: 'tenders', count: 5, enabled: false },
  { name: 'policy', count: 3, enabled: true },
  { name: 'announcements', count: 15, enabled: true },
];

export const RECOMMENDED_NOTICES = [
  {
    id: '1',
    title: 'Bachelor Level Admission Notice 2024',
    category: 'announcements',
    relevance: 95,
    reason: 'Based on your saved notices',
  },
  {
    id: '2',
    title: 'Merit Scholarship Application Open',
    category: 'vacancies',
    relevance: 92,
    reason: 'Similar to items you viewed',
  },
  {
    id: '3',
    title: 'Engineering Entrance Mock Test Schedule',
    category: 'exams',
    relevance: 88,
    reason: 'Related to your interests',
  },
];

export const USER_STATS = {
  savedNotices: 8,
  documentsViewed: 24,
  questionsAsked: 12,
  activeSubscriptions: 4,
};
