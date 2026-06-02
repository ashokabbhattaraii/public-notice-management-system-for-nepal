# Public Notice Management System - Feature Documentation

This document outlines all features and functionalities of the Public Notice Management System frontend application. This is design-agnostic documentation focusing solely on what the system does, not how it looks.

## Table of Contents

1. [System Overview](#system-overview)
2. [User Roles & Permissions](#user-roles--permissions)
3. [Public Features (Unauthenticated)](#public-features-unauthenticated)
4. [User Dashboard Features](#user-dashboard-features)
5. [Admin Dashboard Features](#admin-dashboard-features)
6. [RAG (Document Search) Features](#rag-document-search-features)
7. [Cross-Cutting Features](#cross-cutting-features)

---

## System Overview

### Application Type
- Next.js 16 web application with App Router
- React 19 frontend
- Client-side state management using React Context
- localStorage for data persistence (local-only mode)

### Core Modules
1. **Public Notice Browsing** - Browse and search public notices
2. **User Dashboard** - Personalized dashboard for registered users
3. **Admin Panel** - Administrative interface for system management
4. **RAG System** - Document upload and AI-powered search
5. **Authentication** - User registration and login
6. **Alert System** - Customizable notification rules
7. **Multilingual Support** - English and Nepali language support

---

## User Roles & Permissions

### 1. Guest (Unauthenticated)
**Can Access:**
- Browse all public notices
- View notice details
- Filter and search notices
- View about page
- Sign up for account
- Log in to existing account

**Cannot Access:**
- User dashboard
- Admin panel
- Alert management
- Notice saving/bookmarking
- RAG document upload
- Personalized recommendations

### 2. User (Authenticated Regular User)
**All Guest Permissions +**
- Access personal dashboard
- Save/bookmark notices
- View recent activity
- Set up custom alert rules
- Receive personalized notice recommendations
- Track notice statistics
- View reading history
- Access RAG chat interface
- Browse RAG documents

**Cannot Access:**
- Admin dashboard
- Notice management (create/edit/delete)
- User management
- System settings
- Content moderation
- Web scraping configuration

### 3. Admin (Authenticated Administrator)
**All User Permissions +**
- Full admin dashboard access
- Create, edit, delete notices
- Manage notice categories
- User management (view, create, edit, delete users)
- Upload RAG documents
- Configure web scraping sources
- Monitor scraping tasks
- Content moderation queue
- System statistics and analytics
- System configuration

---

## Public Features (Unauthenticated)

### Landing Page
**Features:**
- Hero section introducing the system
- Featured/priority notices display
- Quick statistics (total notices, categories, etc.)
- Call-to-action for sign up
- Access to main notice listing

### Notice Browsing
**Features:**
- View all published notices in card/list format
- Each notice shows:
  - Title
  - Description excerpt
  - Category badge
  - Organization name
  - Published date
  - Priority indicator (high/normal/low)
  - View count
  - Deadline (if applicable)

### Notice Filtering
**Filter Options:**
- By category:
  - Exams
  - Vacancies
  - Tenders
  - Policy
  - Announcements
- By organization
- By date range
- By priority level

### Notice Search
**Search Capabilities:**
- Full-text search across:
  - Notice titles
  - Descriptions
  - Content
  - Organization names
- Real-time search results
- Search result highlighting

### Notice Detail View
**Information Displayed:**
- Full notice title
- Complete description
- Category and organization
- Published and last updated dates
- Deadline information
- View count
- Priority level
- Author information
- Full notice content
- Downloadable attachments (if any)
- Related notices suggestions

### About Page
**Content:**
- System description and purpose
- How to use the platform
- Contact information
- FAQs

### Authentication Pages

#### Sign Up
**Fields:**
- Username
- Email address
- Password
- Password confirmation
- Optional: Role selection (defaults to 'user')

**Validation:**
- Username uniqueness
- Email format validation
- Password strength requirements
- Email uniqueness

#### Login
**Fields:**
- Username or Email
- Password

**Features:**
- Remember session
- Error messaging for invalid credentials
- Redirect to dashboard on success

---

## User Dashboard Features

### Dashboard Overview
**Sections:**
1. Welcome header with username
2. Personal statistics panel
3. Saved notices section
4. Recent activity feed
5. Recommended notices
6. Quick actions menu

### Personal Statistics
**Metrics Displayed:**
- Total notices viewed
- Notices bookmarked/saved
- Active alerts count
- Unread notifications count
- Account age/join date

### Saved Notices
**Features:**
- View all bookmarked notices
- Quick access to saved notice details
- Remove notices from saved list
- Sort by save date or priority
- Filter saved notices by category

### Recent Activity
**Activity Types Tracked:**
- Notices viewed (with timestamp)
- Notices saved/unsaved
- Alerts triggered
- Searches performed
- Documents accessed (RAG)

**Display Information:**
- Activity type icon
- Activity description
- Timestamp (relative or absolute)
- Link to related content

### Recommended Notices
**Recommendation Criteria:**
- Based on user's viewing history
- Based on saved notice categories
- Based on alert preferences
- Priority notices in relevant categories
- Trending notices

**Display:**
- Notice cards with relevance indicator
- "Why recommended" explanation
- Quick save action
- Direct link to full notice

### Alert Management
**Alert Types:**
1. **Keyword Alerts**
   - Trigger on notices containing specific keywords
   - Multiple keywords per alert (OR/AND logic)
   - Case-insensitive matching

2. **Category Alerts**
   - Notifications for all notices in selected categories
   - Multi-category selection

3. **Organization Alerts**
   - Notifications from specific organizations
   - Multiple organization tracking

**Alert Configuration:**
- Enable/disable individual alerts
- Set alert priority
- Configure notification frequency
- Edit alert conditions
- Delete alerts
- View alert match history

### Alert Rules Dashboard
**Features:**
- List all active alerts
- View matched notices per alert
- Alert statistics (matches today/this week)
- Quick toggle alert on/off
- Create new alert rules
- Search through alerts

### Quick Actions
**Available Actions:**
- Browse all notices
- Access RAG search
- Create new alert
- View all saved notices
- Account settings
- Logout

---

## Admin Dashboard Features

### Admin Overview
**Dashboard Sections:**
1. System statistics cards
2. Recent scraping tasks status
3. Content moderation queue
4. Recent system activity
5. Quick action buttons

### System Statistics
**Metrics:**
- Total notices published
- Total active users
- Total RAG documents
- Pending moderation items
- Storage usage
- System uptime

**Statistics Features:**
- Real-time updates
- Trend indicators (up/down from previous period)
- Drill-down to detailed views

### Notice Management

#### Notice List View
**Features:**
- Table view of all notices (paginated)
- Columns:
  - Title
  - Category
  - Organization
  - Published date
  - Priority
  - Views
  - Status (published/draft)
  - Actions

**Actions:**
- Edit notice
- Delete notice
- Duplicate notice
- Change priority
- View full details
- Preview public view

#### Create Notice
**Form Fields:**
- Title (required)
- Description (required)
- Category (dropdown, required)
- Organization (required)
- Content (rich text editor)
- Priority level
- Published date
- Deadline date (optional)
- Attachments (file upload)

**Features:**
- Draft saving
- Preview before publish
- Schedule publishing
- Rich text formatting
- Image embedding
- File attachment support

#### Edit Notice
**All Create Notice Features +**
- View edit history
- Revert to previous version
- Last updated timestamp
- Auto-save drafts

### Category Management
**Features:**
- View all categories
- Create new categories
- Edit category names
- Delete categories (with notice reassignment)
- Category statistics (notice count)
- Category ordering/priority

### User Management

#### User List
**Display:**
- Table view of all users
- Columns:
  - Username
  - Email
  - Role
  - Join date
  - Last login
  - Status (active/inactive)
  - Actions

**Features:**
- Search users by username/email
- Filter by role
- Sort by any column
- Pagination

#### User Actions
**Available Actions:**
- View user details
- Edit user information
- Change user role (user ↔ admin)
- Deactivate/activate account
- Reset user password
- Delete user (with confirmation)

#### Create User (Admin Creation)
**Form Fields:**
- Username
- Email
- Password
- Role assignment
- Initial status

### Web Scraping Configuration

#### Scraping Sources
**Management Features:**
- List all configured scraping sources
- Add new scraping source:
  - Source name
  - URL/endpoint
  - Scraping frequency
  - Category mapping
  - CSS selectors/API configuration
  - Active/inactive status
- Edit existing sources
- Delete sources
- Test scraping configuration

#### Scraping Tasks Monitor
**Display:**
- Task history table showing:
  - Task ID
  - Source name
  - Start time
  - Duration
  - Status (active/completed/error/paused)
  - Items scraped
  - Error messages (if any)

**Actions:**
- View task details
- Retry failed tasks
- Pause active tasks
- View scraped items
- Manual trigger scraping

#### Scraping Schedule
**Configuration:**
- Set scraping frequency per source
- Configure retry logic
- Set timeout limits
- Error notification settings

### Content Moderation

#### Moderation Queue
**Display:**
- List of items requiring moderation:
  - Auto-scraped notices
  - User-submitted content
  - Flagged content

**Information Shown:**
- Content preview
- Source
- Submission date
- AI-suggested category
- Confidence score
- Flags/warnings

#### Moderation Actions
**Available Actions:**
- Approve (publish content)
- Reject (discard content)
- Edit before approval
- Assign to category
- Flag for review
- Bulk actions (approve/reject multiple)

### System Settings
**Configurable Options:**
- Site title and description
- Default language
- Notification settings
- Email configuration (future)
- Storage limits
- API rate limits
- Maintenance mode toggle

---

## RAG (Document Search) Features

### Document Library

#### Browse Documents
**Display:**
- Card/grid view of all documents
- Document information:
  - Title
  - Category
  - Upload date
  - File size
  - View count
  - Summary/description

**Features:**
- Filter by category
- Search by title
- Sort options:
  - Newest first
  - Most viewed
  - Alphabetical
- Pagination

#### Document Card
**Information:**
- Document icon (based on type)
- Title
- Category badge
- Upload date
- File size
- View count
- Summary preview

**Actions:**
- View document details
- Open in viewer
- Ask questions about document
- Share link (future)

### Document Upload (Admin Only)
**Upload Interface:**
- Drag-and-drop file upload
- File browser selection
- Multiple file upload support

**Supported Formats:**
- PDF documents
- Word documents (.doc, .docx)
- Text files (.txt)
- (Extensible to other formats)

**Upload Process:**
1. Select files
2. Auto-fill title (from filename)
3. Select/create category
4. Add description/summary
5. Process and vectorize
6. Confirm upload success

**Upload Features:**
- Upload progress indicator
- Batch upload support
- File size validation
- Format validation
- Automatic text extraction
- Vector embedding generation

### RAG Chat Interface

#### Query Interface
**Features:**
- Chat-style message interface
- Message input field
- Send button
- Loading indicator during processing

**Query Types Supported:**
- Natural language questions
- Keyword searches
- Multi-document queries
- Follow-up questions (context-aware)

#### Response Display
**Information Shown:**
- AI-generated answer
- Source documents referenced
- Relevant excerpts from documents
- Confidence indicators
- Related questions suggestions

**Interaction Features:**
- Copy answer to clipboard
- View source documents
- Ask follow-up questions
- Rate answer quality (thumbs up/down)
- Share conversation (future)

#### Chat History
**Features:**
- View previous conversations
- Search conversation history
- Resume previous chats
- Delete conversations
- Export conversations

### Floating Chat Widget
**Features:**
- Minimizable chat interface
- Accessible from any page
- Quick question input
- Recent queries display
- Notification of new insights

---

## Cross-Cutting Features

### Navigation

#### Public Header
**Elements:**
- Site logo/title
- Main navigation links:
  - Home
  - Notices
  - About
  - RAG/Search
- Language switcher
- Login/Sign up buttons (when not authenticated)
- User menu (when authenticated):
  - Dashboard
  - Saved notices
  - Alerts
  - Settings
  - Logout

#### Admin Navigation
**Elements:**
- Admin panel indicator
- Navigation menu:
  - Dashboard
  - Notices management
  - Categories
  - Users
  - Documents
  - Scraping
  - System
- Return to public view option
- User profile dropdown

### Footer
**Content:**
- System name and description
- Quick links:
  - About
  - Contact
  - Privacy policy
  - Terms of service
- Social media links (future)
- Copyright information

### Language Support

#### Supported Languages
1. English (en)
2. Nepali (ne)

#### Language Features
**Translatable Elements:**
- Navigation labels
- Page headings and labels
- Button text
- Form labels and placeholders
- Error messages
- System notifications
- Static content

**Language Switching:**
- Dropdown selector in header
- Persists selection in localStorage
- Instant UI language change
- No page reload required

**Content Translation:**
- Notice titles and content (stored per language)
- Category names
- UI elements
- Date/time formatting (locale-aware)

### Alert System

#### Alert Types
1. **Success Alerts** - Confirm successful actions
2. **Error Alerts** - Display error messages
3. **Warning Alerts** - Show warnings
4. **Info Alerts** - General information

#### Alert Notifications
**Trigger Events:**
- New notices matching user alerts
- System maintenance notifications
- Account activity notifications
- Successful form submissions
- Error conditions

**Display Options:**
- Toast notifications (temporary)
- Persistent banners (dismissible)
- In-app notification center
- Badge counters

### Responsive Behavior
**Device Support:**
- Desktop (1024px+)
- Tablet (768px - 1023px)
- Mobile (< 768px)

**Responsive Features:**
- Adaptive navigation (hamburger menu on mobile)
- Responsive card grids (1/2/3 columns)
- Touch-optimized interactions
- Mobile-friendly forms
- Readable typography across devices

### Accessibility Features
**Implemented:**
- Keyboard navigation support
- ARIA labels and roles
- Focus indicators
- Screen reader compatibility
- Semantic HTML structure
- Color contrast compliance
- Alternative text for images
- Form validation messages

### Search Functionality

#### Global Search
**Search Scope:**
- Notice titles
- Notice descriptions
- Notice content
- Organization names
- Category names

**Features:**
- Real-time search (debounced)
- Search suggestions/autocomplete
- Recent searches history
- Search filters integration
- Clear search button

#### Advanced Search
**Filter Combinations:**
- Multiple categories
- Date ranges (from/to)
- Organization selection
- Priority levels
- Content type
- Deadline status (upcoming/expired)

**Result Display:**
- Relevance sorting
- Highlighted search terms
- Result count
- Pagination
- Results per page selector

### Data Management

#### Local Storage Structure
**Stored Data:**
- User accounts and sessions
- Notices collection
- User preferences (language, theme)
- Saved notices (bookmarks)
- Alert rules
- RAG documents metadata
- Chat history
- Activity logs

**Data Synchronization:**
- Cross-tab synchronization (storage events)
- Custom event system for real-time updates
- Conflict resolution for concurrent edits

#### Data Import/Export (Admin)
**Features:**
- Export notices to JSON/CSV
- Import notices from JSON/CSV
- Bulk data operations
- Backup and restore functionality
- Data validation on import

### State Management

#### Context Providers
1. **AuthContext**
   - Current user state
   - Authentication methods (login, logout, signup)
   - Loading states
   - Session management

2. **AlertsContext**
   - Alert rules state
   - Alert matching logic
   - Matched notices tracking
   - Alert CRUD operations

3. **LanguageContext**
   - Current language state
   - Translation function
   - Language switching
   - Locale formatting

#### Local State
- Component-specific state (forms, modals, etc.)
- UI state (dropdown open/closed, etc.)
- Temporary form data
- Filter selections

### Error Handling

#### Error Types
1. **Validation Errors** - Form input validation
2. **Authentication Errors** - Login/session issues
3. **Not Found Errors** - Missing resources
4. **Permission Errors** - Unauthorized access
5. **Network Errors** - API communication issues (future)

#### Error Display
**Methods:**
- Inline form validation messages
- Modal error dialogs
- Toast notifications
- Error pages (404, 403, 500)
- Graceful fallbacks

### Loading States

#### Loading Indicators
**Types:**
- Full page loaders
- Component skeletons
- Button loading spinners
- Progress bars (file uploads)
- Inline loading text

**Applied To:**
- Page transitions
- Data fetching
- Form submissions
- File uploads
- Search queries

### Performance Features

#### Optimization Techniques
- Client-side caching (localStorage)
- Debounced search inputs
- Lazy loading of components
- Pagination for large datasets
- Memoization of expensive computations
- Optimistic UI updates

### Security Features

#### Authentication Security
- Password hashing (in local mode)
- Session token management
- Auto-logout on inactivity (configurable)
- Password strength validation

#### Authorization Checks
- Route protection (auth required)
- Role-based access control
- Component-level permission checks
- API endpoint protection (future)

#### Data Protection
- XSS prevention (React's built-in)
- Input sanitization
- SQL injection prevention (N/A in local mode)
- CSRF protection (future API integration)

---

## Future Enhancements (Not Yet Implemented)

### Planned Features
1. **Backend Integration**
   - Connect to NestJS API
   - Connect to Python AI service
   - Real database (PostgreSQL)
   - Vector database for RAG

2. **Advanced RAG Features**
   - Multi-modal search (images, tables)
   - Document comparison
   - Citation tracking
   - Answer quality scoring

3. **Notifications**
   - Email notifications
   - Push notifications
   - SMS alerts
   - In-app notification center

4. **Social Features**
   - Comments on notices
   - Rating system
   - Share to social media
   - User discussions

5. **Analytics**
   - User behavior tracking
   - Popular notices dashboard
   - Search analytics
   - Conversion tracking

6. **Advanced Admin Features**
   - Workflow automation
   - Scheduled publishing
   - Content versioning
   - Audit logs
   - System monitoring dashboard

7. **Mobile App**
   - Native iOS/Android apps
   - Progressive Web App (PWA)
   - Offline support

---

## Technical Notes

### Current Implementation Status
- ✅ Frontend fully functional in local-only mode
- ✅ All features use localStorage for persistence
- ✅ Mock data for testing and demonstration
- ⏳ Backend API scaffold exists but not connected
- ⏳ AI service scaffold exists but not connected
- ⏳ RAG functionality is UI-only (no actual vector search)

### Known Limitations
- TypeScript errors suppressed in build config
- No real-time database persistence
- No actual AI/ML processing
- Limited to single browser/device (localStorage)
- No proper authentication (client-side only)
- No file storage (attachments are placeholder links)

### Migration Path (Local → Production)
1. Connect auth to NestJS API
2. Replace localStorage with API calls
3. Implement real file upload to cloud storage
4. Connect RAG UI to Python AI service
5. Add proper session management
6. Implement server-side validation
7. Add real-time updates (WebSockets)
8. Deploy backend services

---

## Summary

This system provides a comprehensive public notice management platform with three distinct user experiences:

1. **Public Users** can browse, search, and view notices without authentication
2. **Registered Users** get personalized features like saved notices, custom alerts, and RAG search
3. **Administrators** have full control over content, users, and system configuration

The modular architecture and clear separation of concerns make it easy to:
- Apply different design systems
- Extend functionality
- Migrate from local-only to full-stack
- Add new features without breaking existing ones

All features are designed to be design-agnostic, allowing for complete visual redesigns without changing functionality.
