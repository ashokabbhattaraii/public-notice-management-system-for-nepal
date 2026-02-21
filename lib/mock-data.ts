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
  organization: string;
  deadline?: Date;
  attachments: Array<{ name: string; url: string }>;
}

export const MOCK_NOTICES: Notice[] = [
  {
    id: '1',
    title: 'Nepal PSC Non-Technical Services Exam 2081 - Notice',
    description: 'Official notification for the Non-Technical Services examination scheduled for 2081',
    category: 'exams',
    organization: 'Public Service Commission Nepal',
    content: `The Public Service Commission has announced the date for Non-Technical Services Examination 2081.
    
    Examination Details:
    - Date: Chaitra 10-15, 2081 (March 23-28, 2025)
    - Venue: Districts across Nepal
    - Application Deadline: Falgun 20, 2081 (February 28, 2025)
    
    Eligible candidates must have bachelor's degree from a recognized university. Age limit: 18-35 years. Candidates from underprivileged sections will be given 5-year age relaxation.`,
    publishedDate: new Date('2025-02-01'),
    lastUpdated: new Date('2025-02-15'),
    deadline: new Date('2025-02-28'),
    views: 3420,
    priority: 'high',
    author: 'PSC Office',
    attachments: [
      { name: 'Exam_Notice_NTS_2081.pdf', url: '#' },
      { name: 'Syllabus.pdf', url: '#' }
    ]
  },
  {
    id: '2',
    title: 'Faculty of Science, Tribhuvan University - Admission 2081 B.Sc. Programs',
    description: 'Admission notification for Bachelor of Science programs in Faculty of Science',
    category: 'vacancies',
    organization: 'Tribhuvan University',
    content: `Tribhuvan University Faculty of Science invites applications for B.Sc. programs for the academic year 2081.

    Available Programs:
    - B.Sc. in Physics
    - B.Sc. in Chemistry
    - B.Sc. in Botany
    - B.Sc. in Zoology
    - B.Sc. in Microbiology
    - B.Sc. in Mathematics
    
    Admission Criteria:
    - Pass in NEB Class 12 or equivalent
    - Minimum 50% marks in Science stream
    - Application submission deadline: Chaitra 5, 2081 (March 18, 2025)
    
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
    title: 'Nepal Rastra Bank - Currency Printing Tender 2081',
    description: 'Open tender for currency printing and security features development',
    category: 'tenders',
    organization: 'Nepal Rastra Bank',
    content: `Nepal Rastra Bank invites sealed tenders for currency printing and related security features.

    Scope of Work:
    - Currency note printing (denominations: Rs. 10, 20, 50, 100, 500, 1000)
    - Security features enhancement
    - Substrate procurement
    - Quality assurance testing
    
    Tender Details:
    - Tender ID: NRB/2081/CURR/001
    - Submission Deadline: Chaitra 10, 2081 (March 23, 2025)
    - Opening Date: Chaitra 12, 2081 (March 25, 2025)
    - Project Duration: 18 months
    
    Interested vendors must be registered with Nepal Rastra Bank and have ISO certification.`,
    publishedDate: new Date('2024-02-25'),
    lastUpdated: new Date('2024-03-02'),
    deadline: new Date('2025-03-23'),
    views: 450,
    priority: 'high',
    author: 'Procurement Officer',
    attachments: [
      { name: 'Tender_Document.pdf', url: '#' },
      { name: 'Technical_Specifications.pdf', url: '#' },
      { name: 'BOQ.xlsx', url: '#' }
    ]
  },
  {
    id: '4',
    title: 'Ministry of Foreign Affairs - Diplomatic Service Recruitment',
    description: 'Recruitment for Foreign Service Officers and Administrative positions',
    category: 'vacancies',
    organization: 'Ministry of Foreign Affairs Nepal',
    content: `The Ministry of Foreign Affairs Nepal is recruiting Foreign Service Officers and Administrative Staff for various positions.

    Positions Available:
    - Foreign Service Officer (15 positions)
    - Administrative Officer (8 positions)
    - Translator/Interpreter (5 positions)
    - Protocol Officer (3 positions)
    
    Qualifications:
    - Bachelor's degree from recognized university
    - Fluency in English and one additional language
    - Knowledge of international relations and diplomacy
    - Age: 21-40 years
    
    Application Deadline: Chaitra 5, 2081 (March 18, 2025)
    Written test and interview will be conducted for shortlisted candidates.
    
    Apply through: recruitment.mofa.gov.np`,
    publishedDate: new Date('2024-02-20'),
    lastUpdated: new Date('2024-03-05'),
    deadline: new Date('2025-03-18'),
    views: 2100,
    priority: 'high',
    author: 'HR Section',
    attachments: [
      { name: 'Job_Description.pdf', url: '#' },
      { name: 'Recruitment_Notice.pdf', url: '#' }
    ]
  },
  {
    id: '5',
    title: 'Updated Foreign Trade Policy - 2081',
    description: 'New regulations for import-export procedures and customs duties',
    category: 'policy',
    organization: 'Department of Customs Nepal',
    content: `The Department of Customs Nepal has announced updated foreign trade policies effective from Falgun 1, 2081.

    Key Changes:
    - Revised import duty rates for electronic items (reduced by 5%)
    - New export promotion scheme for agricultural products
    - Simplified documentation for priority goods
    - Enhanced e-commerce monitoring procedures
    - Introduction of single-window clearance system
    
    Compliance:
    - All traders must register with new system by Falgun 15, 2081
    - Previous registration remains valid with migration
    - Training sessions scheduled at all customs offices
    
    Queries: customs-helpline@customs.gov.np`,
    publishedDate: new Date('2024-03-05'),
    lastUpdated: new Date('2024-03-10'),
    deadline: new Date('2025-01-01'),
    views: 750,
    priority: 'normal',
    author: 'Trade Division',
    attachments: [
      { name: 'Complete_Policy_2081.pdf', url: '#' }
    ]
  },
  {
    id: '6',
    title: 'Office of PM - Independence Day Celebration - Volunteer Recruitment',
    description: 'Recruiting volunteers for National Independence Day celebrations',
    category: 'announcements',
    organization: 'Office of PM and Council of Ministers Nepal',
    content: `The Office of the Prime Minister is recruiting volunteers for the 81st National Independence Day celebrations.

    Volunteer Opportunities:
    - Event Coordination (50 volunteers)
    - Security & Safety (30 volunteers)
    - Media & Communications (20 volunteers)
    - Logistics & Transportation (40 volunteers)
    - Guest Relations (25 volunteers)
    
    Requirements:
    - Nepalese citizen, age 18-45 years
    - Good communication skills
    - Willing to work full day
    - No criminal record
    
    Dates: Baishakh 15-20, 2081 (April 29 - May 4, 2025)
    Venue: Kathmandu and district headquarters
    Stipend: Rs. 500 per day + meals
    
    Application Deadline: Falgun 28, 2081 (March 10, 2025)`,
    publishedDate: new Date('2024-02-15'),
    lastUpdated: new Date('2024-02-20'),
    deadline: new Date('2025-03-10'),
    views: 1850,
    priority: 'high',
    author: 'Events Management',
    attachments: [
      { name: 'Volunteer_Application_Form.pdf', url: '#' }
    ]
  },
  {
    id: '7',
    title: 'TU Scholarship for Economically Disadvantaged Students - 2081',
    description: 'Full scholarship opportunities for economically disadvantaged students',
    category: 'announcements',
    organization: 'Tribhuvan University',
    content: `Tribhuvan University announces merit-based scholarships for economically disadvantaged students.

    Eligibility:
    - Annual family income below Rs. 2,50,000
    - CGPA: 3.0 or above (minimum)
    - Currently enrolled students preferred
    - No other scholarship recipients
    
    Award Details:
    - Full Tuition Scholarship
    - Monthly stipend: Rs. 3,000
    - Book allowance: Rs. 5,000 per semester
    - Hostel fee assistance (if applicable)
    
    Application Process:
    - Apply through university portal
    - Submit income certificate from VDC
    - Recommendation letter from faculty adviser
    - Interview round for final selection
    
    Deadline: Chaitra 15, 2081 (March 28, 2025)`,
    publishedDate: new Date('2024-02-18'),
    lastUpdated: new Date('2024-02-25'),
    deadline: new Date('2025-03-28'),
    views: 2340,
    priority: 'high',
    author: 'Scholarship Cell',
    attachments: [
      { name: 'Scholarship_Guidelines_2081.pdf', url: '#' }
    ]
  },
  {
    id: '8',
    title: 'PSC Technical Services Examination - 2081 Admit Card Release',
    description: 'Admit cards for Technical Services examination now available',
    category: 'exams',
    organization: 'Public Service Commission Nepal',
    content: `Admit cards for the Technical Services Examination 2081 are now available for download.

    Important Information:
    - Download from: psc.gov.np/admitcard
    - Exam Date: Chaitra 8-10, 2081 (March 21-23, 2025)
    - Time: 1:00 PM - 3:00 PM
    - Total Questions: 100 (MCQ format)
    - Negative Marking: 0.25 marks per wrong answer
    
    Required Documents:
    - Admit Card (printed)
    - Valid ID (Citizenship/Passport)
    - Black/Blue pen and pencil
    
    Note: Report 30 minutes before exam time. Examination centers will be assigned district-wise.`,
    publishedDate: new Date('2024-03-01'),
    lastUpdated: new Date('2024-03-10'),
    deadline: new Date('2025-03-21'),
    views: 5680,
    priority: 'high',
    author: 'Examination Division',
    attachments: [
      { name: 'Exam_Instructions.pdf', url: '#' },
      { name: 'Test_Centers.pdf', url: '#' }
    ]
  },
  {
    id: '9',
    title: 'NRB - New Notes & Coins Issued - Information Campaign',
    description: 'Public awareness campaign for newly issued currency denominations',
    category: 'announcements',
    organization: 'Nepal Rastra Bank',
    content: `Nepal Rastra Bank has issued new currency notes and coins with enhanced security features.

    New Features:
    - Enhanced holograms and color-shifting inks
    - Improved anti-counterfeiting measures
    - Better durability and texture
    - Accessibility features for visually impaired
    
    Denominations Released:
    - Notes: Rs. 10, 20, 50, 100, 500, 1000, 2000
    - Coins: Rs. 1, 2, 5, 10, 25, 50
    
    Exchange:
    - Old currency can be exchanged at any commercial bank
    - No deadline for exchange
    - Both old and new notes are legal tender
    
    For counterfeiting reports: nrb-security@nrb.org.np`,
    publishedDate: new Date('2024-02-28'),
    lastUpdated: new Date('2024-03-08'),
    views: 1250,
    priority: 'normal',
    author: 'Communications',
    attachments: [
      { name: 'New_Currency_Details.pdf', url: '#' }
    ]
  },
  {
    id: '10',
    title: 'MOFA - Diplomatic Passport Application - New Online System',
    description: 'Diplomatic passport application process now available online',
    category: 'announcements',
    organization: 'Ministry of Foreign Affairs Nepal',
    content: `The Ministry of Foreign Affairs has launched an online system for diplomatic passport applications.

    Key Features:
    - Online application submission
    - Real-time status tracking
    - Reduced processing time (15 days)
    - Digital verification system
    
    Eligible Applicants:
    - Government officials on foreign postings
    - Diplomatic personnel
    - Authorized government representatives
    
    Process:
    1. Create account on mofa.gov.np
    2. Fill application form with required documents
    3. Pay processing fee (Rs. 5,000)
    4. Schedule biometric appointment
    5. Collect passport within 15 days
    
    Support: passport-support@mofa.gov.np`,
    publishedDate: new Date('2024-03-05'),
    lastUpdated: new Date('2024-03-09'),
    views: 890,
    priority: 'normal',
    author: 'Passport Division',
    attachments: [
      { name: 'Online_System_Guide.pdf', url: '#' }
    ]
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
