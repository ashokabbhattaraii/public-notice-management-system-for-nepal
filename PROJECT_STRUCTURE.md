# NoticeBoard Project Structure

A fully functional, production-ready frontend for institutional notice management with AI-powered document retrieval.

## 📁 Folder Structure

```
/vercel/share/v0-project/
├── app/
│   ├── layout.tsx                 # Root layout with AuthProvider
│   ├── page.tsx                   # Home page (Notices listing)
│   ├── globals.css                # Global styles with design tokens
│   ├── login/
│   │   └── page.tsx              # Login page
│   ├── signup/
│   │   └── page.tsx              # Signup page
│   ├── rag/
│   │   └── page.tsx              # Documents & AI Assistant page
│   └── about/
│       └── page.tsx              # About page
│
├── components/
│   ├── layout/
│   │   ├── header.tsx            # Main navigation header
│   │   └── footer.tsx            # Footer with links
│   │
│   ├── notices/
│   │   ├── notice-card.tsx       # Individual notice card component
│   │   ├── notice-filters.tsx    # Search and filter controls
│   │   └── notice-detail-modal.tsx # Notice details modal dialog
│   │
│   ├── rag/
│   │   ├── document-card.tsx     # Document card in grid
│   │   └── rag-qa.tsx            # AI Q&A chat interface
│   │
│   └── ui/                        # shadcn/ui components (pre-installed)
│
├── lib/
│   ├── auth-context.tsx          # Authentication context with localStorage
│   ├── mock-data.ts              # Dummy data (10 notices, 4 documents)
│   └── utils.ts                  # Utility functions
│
└── public/                        # Static assets
```

## 🎯 Key Features

### 1. **Notice Management**
- Browse 10 institutional notices across 5 categories
- Filter by category, priority, and search
- View detailed notice information in modal
- Save/bookmark notices (localStorage)
- Shows view count and attachments

### 2. **Document Management & RAG**
- 4 institutional documents with categories
- Download documents
- AI-powered Q&A assistant
- Source attribution in responses
- Real-time chat interface with loading states

### 3. **Authentication System**
- Works with or without authentication
- Sign in/Sign up functionality
- localStorage-based session persistence
- Guest browsing enabled
- User profile in header

### 4. **UX/Usability Focus**
- Responsive design (mobile-first)
- Loading skeletons
- Empty states with helpful messages
- Toast notifications ready
- Dark mode compatible
- Accessibility-first approach
- Sticky header and filters
- Smooth animations and transitions

## 📊 Data Structure

### Notices (10 mock notices)
- Title, description, full content
- Categories: exams, vacancies, tenders, policy, announcements
- Priority levels: high, normal, low
- Publication date, views, author
- Attachments array with download links

### Documents (4 mock documents)
- Categories: handbooks, guides, academic, financial
- Upload date, file size, view count
- Download functionality

## 🔐 Authentication

**Dual-Mode System:**
- **Authenticated**: Full access + saved items
- **Guest**: Full access to notices and documents, no persistence
- localStorage for session management
- Demo credentials in login page

## 🎨 Design System

### Colors (oklch format)
- **Primary**: Vibrant blue (265°)
- **Accent**: Teal/cyan (180°)
- **Neutrals**: Professional grays and whites
- **Semantic**: Green (success), Amber (warning), Red (destructive)

### Typography
- Sans-serif: Geist (from Google Fonts)
- Mono: Geist Mono
- Responsive text sizes

### Components Used
- Buttons, cards, dialogs, dropdowns
- Input fields, selects, badges
- Scrollable areas, separators
- Icons from Lucide

## 🚀 Getting Started

### Run the development server:
```bash
pnpm dev
```

### Open [http://localhost:3000](http://localhost:3000)

### Features to try:
1. Click on a notice to view details
2. Search and filter notices
3. Visit `/rag` page for documents and AI Q&A
4. Sign up or login (any credentials work in demo)
5. Save notices when authenticated
6. Browse as guest without login

## 📝 Key Implementation Details

### State Management
- React hooks (useState, useMemo, useContext)
- Context API for authentication
- localStorage for persistence

### Performance
- Memoized filtered notices list
- Lazy-loaded modals
- Skeleton loaders
- Optimized re-renders

### Accessibility
- Semantic HTML elements
- ARIA labels and roles
- Keyboard navigation support
- Color contrast compliance
- Screen reader friendly

## 🔄 Authentication Flow

```
Guest User
    ↓
All Features Available (no persistence)
    ↓
Click Login/Signup
    ↓
Create Account (localStorage)
    ↓
Full Features + Saved Items
    ↓
Logout → localStorage cleared
```

## 📱 Responsive Breakpoints

- **Mobile**: < 640px
- **Tablet**: 640px - 1024px
- **Desktop**: > 1024px

All components adapt seamlessly across screens.

## 🛠️ Customization

### Add More Notices
Edit `/lib/mock-data.ts` and add to `MOCK_NOTICES` array

### Modify Colors
Update design tokens in `/app/globals.css`

### Change Categories
Update category types in mock-data.ts interfaces

### Extend RAG
Modify response logic in `/components/rag/rag-qa.tsx`

## 📦 Dependencies

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS
- shadcn/ui
- Lucide Icons
- Vercel Analytics

All pre-configured and ready to use!
