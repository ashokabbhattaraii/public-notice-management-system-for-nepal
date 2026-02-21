export interface Notice {
  id: string;
  title: string;
  description: string;
  category: 'exams' | 'vacancies' | 'tenders' | 'policy' | 'announcements';
  content: string;
  publishedDate: Date;
  lastUpdated: Date;
  views: number;
  priority: 'high' | 'normal' | 'low';
  author: string;
  attachments: Array<{ name: string; url: string }>;
}

export const MOCK_NOTICES: Notice[] = [
  {
    id: '1',
    title: 'Final Semester Exam Schedule - Spring 2024',
    description: 'Important notice regarding final semester examinations scheduled for May-June 2024',
    category: 'exams',
    content: `The final semester examinations will be conducted from May 15 to June 10, 2024.
    
    Detailed schedule:
    - Semester 1: May 15-25
    - Semester 2: May 28 - June 5
    - Semester 3: June 8-10
    
    All students must report 15 minutes before the scheduled examination time. Carry your ID card and admit card.`,
    publishedDate: new Date('2024-03-01'),
    lastUpdated: new Date('2024-03-10'),
    views: 1250,
    priority: 'high',
    author: 'Exam Controller',
    attachments: [
      { name: 'Exam_Schedule.pdf', url: '#' },
      { name: 'Center_Allocation.xlsx', url: '#' }
    ]
  },
  {
    id: '2',
    title: 'Recruitment Drive - Software Developer Positions',
    description: 'Multiple openings for software developers in our development team',
    category: 'vacancies',
    content: `We are hiring passionate software developers with 1-3 years of experience.

    Requirements:
    - Proficiency in JavaScript/TypeScript
    - Experience with React and Node.js
    - Knowledge of database design
    - Excellent problem-solving skills
    
    Compensation: Competitive salary package with health insurance, flexible working hours, and professional development opportunities.
    
    Apply through the recruitment portal with your resume and portfolio.`,
    publishedDate: new Date('2024-02-28'),
    lastUpdated: new Date('2024-03-05'),
    views: 890,
    priority: 'high',
    author: 'HR Department',
    attachments: [
      { name: 'Job_Description.pdf', url: '#' }
    ]
  },
  {
    id: '3',
    title: 'Campus Infrastructure Development Project - Tender Notice',
    description: 'Open tender for construction and renovation of campus facilities',
    category: 'tenders',
    content: `Sealed tenders are invited for the development and renovation of campus infrastructure.

    Scope of Work:
    - New Library Complex (45,000 sq.ft)
    - Renovation of existing dormitories
    - IT Center upgrade
    - Sports facility expansion
    
    Tender Details:
    - Tender ID: TND/2024/001
    - Submission Deadline: March 25, 2024
    - Opening Date: March 28, 2024
    - Project Duration: 24 months
    
    Interested contractors should obtain the tender documents from the administration office or online portal.`,
    publishedDate: new Date('2024-02-25'),
    lastUpdated: new Date('2024-03-02'),
    views: 450,
    priority: 'high',
    author: 'Administration',
    attachments: [
      { name: 'Tender_Document.pdf', url: '#' },
      { name: 'Technical_Specifications.pdf', url: '#' },
      { name: 'BOQ.xlsx', url: '#' }
    ]
  },
  {
    id: '4',
    title: 'New Academic Integrity Policy - Effective April 2024',
    description: 'Updated policies regarding academic conduct and plagiarism',
    category: 'policy',
    content: `Effective from April 1, 2024, the following academic integrity policies will be in force:

    1. Plagiarism Policy:
       - All assignments must be original work
       - Proper citation required for all sources
       - Turnitin similarity check for all submissions
    
    2. Examination Conduct:
       - No electronic devices allowed (except as specified)
       - Malpractice will result in disciplinary action
       - Question papers remain confidential
    
    3. Disciplinary Action:
       - First offense: Warning + 10 marks deduction
       - Second offense: Suspension from exams
       - Third offense: Expulsion from institution
    
    For detailed guidelines, refer to the attached complete policy document.`,
    publishedDate: new Date('2024-03-05'),
    lastUpdated: new Date('2024-03-10'),
    views: 750,
    priority: 'normal',
    author: 'Academic Affairs',
    attachments: [
      { name: 'Complete_Policy.pdf', url: '#' }
    ]
  },
  {
    id: '5',
    title: 'Annual Sports Festival 2024 - Registration Open',
    description: 'Register your team for the upcoming annual sports festival',
    category: 'announcements',
    content: `The Annual Sports Festival 2024 will be held from April 15-20, 2024.

    Events:
    - Football (Men & Women)
    - Basketball (Men & Women)
    - Badminton (Singles & Doubles)
    - Tennis (Men & Women)
    - Track & Field
    - Cricket (Men's & Women's)
    - Volleyball
    
    Registration:
    - Deadline: March 30, 2024
    - Registration Fee: Rs. 5000 per team
    - Minimum 8 players per team
    
    Venue: Central Sports Complex
    For more details, contact the Sports Office.`,
    publishedDate: new Date('2024-03-08'),
    lastUpdated: new Date('2024-03-10'),
    views: 620,
    priority: 'normal',
    author: 'Sports Department',
    attachments: [
      { name: 'Festival_Guidelines.pdf', url: '#' },
      { name: 'Team_Registration_Form.xlsx', url: '#' }
    ]
  },
  {
    id: '6',
    title: 'Library Renovation - Temporary Closure',
    description: 'Main library will be closed for renovation from March 15-April 15',
    category: 'announcements',
    content: `The main library will undergo renovation and expansion from March 15 to April 15, 2024.

    During this period:
    - Main library will be closed to students
    - Emergency reference services available at temporary location (East Building, 2nd Floor)
    - Book issuance/return at temporary desk
    - Online resources remain fully accessible
    
    We apologize for any inconvenience. The expanded library will offer additional seating and modern facilities.`,
    publishedDate: new Date('2024-03-07'),
    lastUpdated: new Date('2024-03-09'),
    views: 540,
    priority: 'normal',
    author: 'Library Services',
    attachments: []
  },
  {
    id: '7',
    title: 'Scholarship Opportunity - Merit-Based Awards',
    description: 'Apply for merit-based scholarships worth Rs. 1-2 lakhs',
    category: 'announcements',
    content: `The institution is offering merit-based scholarships for the academic year 2024-25.

    Eligibility:
    - CGPA: 8.0 or above
    - No disciplinary record
    - Financial need (case-by-case basis)
    
    Award Amount:
    - Full Scholarship: Rs. 2,00,000
    - Partial Scholarship: Rs. 1,00,000
    - Book & Exam Fee: Rs. 50,000
    
    Application Process:
    - Apply through student portal
    - Submit along with financial statement
    - Interview round for shortlisted candidates
    
    Deadline: April 10, 2024`,
    publishedDate: new Date('2024-03-06'),
    lastUpdated: new Date('2024-03-08'),
    views: 680,
    priority: 'normal',
    author: 'Admissions Office',
    attachments: [
      { name: 'Scholarship_Guidelines.pdf', url: '#' }
    ]
  },
  {
    id: '8',
    title: 'Internship Program - Company Partnerships',
    description: 'New internship opportunities with leading tech and finance companies',
    category: 'vacancies',
    content: `We are partnering with leading companies to offer internship opportunities for the Summer 2024.

    Participating Companies:
    - TechCore Solutions (6 positions)
    - FinanceHub Advisors (4 positions)
    - ConsultPro Inc. (5 positions)
    - Digital Marketing Pro (3 positions)
    
    Eligibility:
    - 2nd and 3rd year students
    - CGPA: 6.5+
    - Duration: 8-12 weeks
    - Stipend: Rs. 15,000-25,000 per month
    
    Application deadline: March 20, 2024`,
    publishedDate: new Date('2024-03-04'),
    lastUpdated: new Date('2024-03-07'),
    views: 920,
    priority: 'high',
    author: 'Career Services',
    attachments: [
      { name: 'Company_Details.pdf', url: '#' }
    ]
  },
  {
    id: '9',
    title: 'Mid-Semester Exam Notification',
    description: 'Schedule for mid-semester examinations in April 2024',
    category: 'exams',
    content: `Mid-semester examinations for all programs will be conducted in April 2024.

    Key Dates:
    - Exam Period: April 2-12, 2024
    - Time Slot: 10:00 AM - 1:00 PM
    - Duration: 2 hours per paper
    
    Preparation:
    - Syllabus coverage up to March 31, 2024
    - Revision classes will continue until April 1
    - Previous year papers available in library
    
    Marking:
    - Each paper: 50 marks
    - 25% of final grade
    
    Note: No requests for exam date change will be entertained after March 25.`,
    publishedDate: new Date('2024-03-02'),
    lastUpdated: new Date('2024-03-06'),
    views: 1100,
    priority: 'high',
    author: 'Exam Controller',
    attachments: [
      { name: 'Mid_Sem_Schedule.pdf', url: '#' }
    ]
  },
  {
    id: '10',
    title: 'Campus WiFi Upgrade - Downtime Notice',
    description: 'Internet services will be interrupted for network upgrade',
    category: 'announcements',
    content: `Campus WiFi network will be upgraded to 5G technology from March 12-14, 2024.

    Expected Downtime:
    - March 12: 10:00 PM - 6:00 AM (March 13)
    - March 13: 10:00 PM - 6:00 AM (March 14)
    - March 14: 10:00 PM - 2:00 AM (March 15)
    
    Benefits of Upgrade:
    - 10x faster internet speed
    - Better coverage in all areas
    - Improved security features
    - Support for more simultaneous connections
    
    Please plan your work accordingly. Wired connections will remain active during the maintenance.`,
    publishedDate: new Date('2024-03-03'),
    lastUpdated: new Date('2024-03-05'),
    views: 380,
    priority: 'normal',
    author: 'IT Department',
    attachments: []
  }
];

export const MOCK_RAG_DOCUMENTS = [
  {
    id: 'doc1',
    title: 'Student Handbook 2024',
    category: 'handbooks',
    uploadedDate: new Date('2024-01-15'),
    size: '2.5 MB',
    views: 450,
  },
  {
    id: 'doc2',
    title: 'Campus Map & Facilities Guide',
    category: 'guides',
    uploadedDate: new Date('2024-01-20'),
    size: '1.8 MB',
    views: 320,
  },
  {
    id: 'doc3',
    title: 'Course Catalog 2024-25',
    category: 'academic',
    uploadedDate: new Date('2024-02-01'),
    size: '3.2 MB',
    views: 680,
  },
  {
    id: 'doc4',
    title: 'Financial Aid & Scholarships Guide',
    category: 'financial',
    uploadedDate: new Date('2024-02-10'),
    size: '1.5 MB',
    views: 540,
  },
];

export const CATEGORY_COLORS = {
  exams: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  vacancies: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  tenders: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
  policy: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300',
  announcements: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-300',
};
