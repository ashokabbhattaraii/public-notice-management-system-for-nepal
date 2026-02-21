# NoticeBoard - Complete Usage Guide

## 🎯 For Different Users

### For Students
1. **View Notices**
   - Go to home page
   - Scroll through all notices
   - Click any notice to see full details
   - Check "Exams" category for exam schedules
   - Check "Vacancies" for job opportunities

2. **Search Specific Info**
   - Use search bar to find specific topics
   - Example: "exam schedule" → shows exam-related notices
   - Example: "scholarship" → shows financial aid notices

3. **Save Important Notices**
   - Click the heart icon on any notice
   - Sign up/login to persist saves
   - Your saved notices appear in your profile

4. **Download Documents**
   - Go to Documents page (`/rag`)
   - Browse available resources
   - Click download button on any document

5. **Ask Questions**
   - Use AI Assistant on Documents page
   - Ask about scholarships: "How do I apply for scholarships?"
   - Ask about campus: "Where is the library?"
   - Ask about admissions: "What are the admission requirements?"

---

### For Faculty
1. **Monitor Notices**
   - Check relevant policy notices
   - See announcements affecting your department
   - Review exam schedules for your courses

2. **Access Documents**
   - Download course catalogs
   - Access student handbook for reference
   - Use AI assistant to find specific information

3. **Share Information**
   - Contact admin to publish new notices (feature coming)
   - Direct students to specific notices via links

---

### For Administrators
1. **Manage System** (Coming Soon)
   - Create new notices (UI ready for expansion)
   - Manage documents
   - View analytics
   - User management

2. **Current: Add Content**
   - Edit `lib/mock-data.ts` to add notices
   - Update colors in `app/globals.css`
   - Customize homepage text

---

## 🔍 How to Search & Filter

### Basic Search
1. Click search box on home page
2. Type your query: "exam", "job", "scholarship", etc.
3. Results update in real-time
4. Clear by deleting text or clicking clear button

### Category Filter
1. Open dropdown labeled "All Categories"
2. Select: Exams, Vacancies, Tenders, Policy, or Announcements
3. See only notices in that category
4. Combine with search for better results

### Priority Filter
1. Open dropdown labeled "All Priorities"
2. Select: High Priority, Normal, or Low Priority
3. See notices sorted by importance
4. High priority shows urgent items first

### Combine Filters
1. Filter by category (e.g., "Exams")
2. Filter by priority (e.g., "High")
3. Search for keyword (e.g., "schedule")
4. Get very specific results
5. Click "Clear Filters" to reset all at once

---

## 📖 How to Read Notices

### In Card View (List)
- **Title**: Main headline
- **Category Badge**: What type of notice
- **Priority Badge**: How urgent
- **Description**: Quick preview
- **Author & Date**: Who posted and when
- **View Count**: Popularity
- **Attachment Count**: How many files
- **Heart Icon**: Save for later

### In Detail Modal
1. Click any notice card
2. Modal opens with full content
3. View complete information:
   - Full text content
   - Published & updated dates
   - Author information
   - All attachments with download links
   - View count
4. Click **Save** to bookmark (with login)
5. Click **Share** to copy link
6. Click **X** or ESC to close

---

## 💬 How to Use AI Assistant

### Access
1. Go to Documents page (`/rag`)
2. Scroll to right side (desktop) or below (mobile)
3. See "Ask a Question" panel

### Ask Questions
Examples that work well:
- "What scholarships are available?"
- "What are the admission requirements?"
- "Tell me about campus facilities"
- "How do I access the library?"
- "What documents do you have?"

### How It Works
1. Type your question
2. Click send button (or press Enter)
3. AI thinks for 1 second
4. Response appears with source documents
5. You can copy the response
6. Rate response with thumbs up/down

### Try These Questions
```
"What financial aid is available?"
→ Gets scholarship information from documents

"What campus facilities are available?"
→ Describes library, sports, housing

"What do I need to apply for admission?"
→ Explains admission process

"Where is the student handbook?"
→ Tells you about available documents
```

---

## 🔐 How to Create Account

### Sign Up
1. Click **Sign Up** button in header
2. Fill in:
   - **Full Name**: Your complete name
   - **Email**: Your email address
   - **Password**: Choose password
   - **Role**: Student, Faculty, or Admin
3. Click **Create Account**
4. Redirected to home page (logged in!)

### Login
1. Click **Login** button in header
2. Enter email and password
3. Click **Sign In**
4. See your profile in header

### Demo Account
- Email: demo@example.com
- Password: anything
- Click **Sign In** to try immediately

### After Login
- Your name appears in header
- See user profile dropdown
- Can save notices
- Your data persists across sessions

---

## 📱 Mobile Usage

### On iPhone/Mobile Device
1. **Same features work**: Search, filter, view, save
2. **Header adapts**: Menu button appears (≡)
3. **Sidebar becomes tab**: On smaller screens
4. **Everything is touch-friendly**: Larger tap targets
5. **Modals are full-screen**: Better for mobile

### Tips for Mobile
- Use landscape for better view
- Tap ≡ menu for navigation
- Swipe left/right to close modals
- Scroll smoothly through content
- Text scales automatically

---

## 🎨 Customization (For Developers)

### Change Colors
1. Open `app/globals.css`
2. Find the `:root { ... }` section
3. Change `--primary` value (265 = hue)
4. Try values: 0-360 for different colors
5. Save and see changes instantly

### Add New Notice
1. Open `lib/mock-data.ts`
2. Find `MOCK_NOTICES` array
3. Copy a notice object
4. Modify: title, description, content, category, etc.
5. Add to array
6. Appears in home page immediately

### Customize Homepage
1. Open `app/page.tsx`
2. Find "Institutional Notices & Updates" text
3. Change to your text
4. Update the description paragraph
5. Save changes

### Change App Name
1. Open `components/layout/header.tsx`
2. Change "NoticeBoard" text
3. Update logo (change "N" to your logo)
4. Open `app/layout.tsx`
5. Change metadata title
6. Done!

---

## 🧪 Testing Your Changes

### Search Test
1. Add a notice with unique title (e.g., "TESTNOTICE2024")
2. Go to home page
3. Search for "TEST"
4. Verify notice appears
5. Click to view full content

### Filter Test
1. Create notice with specific category
2. Go to home page
3. Select that category filter
4. Verify notice appears in filtered list
5. Select different category
6. Verify notice disappears

### Authentication Test
1. Go to `/signup`
2. Sign up with test credentials
3. Verify name appears in header
4. Save a notice (click heart)
5. Logout (click profile → logout)
6. Login again
7. Verify saves persist

---

## 🆘 Troubleshooting

### Search Not Working
**Problem**: Typed in search box, no results
**Solution**: Make sure you're typing in the search box on the left side, not a browser search bar

### Filters Not Updating
**Problem**: Changed filter but results didn't change
**Solution**: Make sure search box is empty. Search + filter together = very specific results

### Account Not Saving
**Problem**: Signed up but after refresh, logged out
**Solution**: Check if browser localStorage is enabled (Settings → Privacy)

### Modal Not Opening
**Problem**: Clicked notice but nothing happened
**Solution**: Try clicking again, or refresh page and retry

### Questions Not Answered
**Problem**: Asked AI question but got generic response
**Solution**: Try asking about: scholarships, facilities, admissions, or documents

### Colors Look Wrong
**Problem**: Colors are inverted or different
**Solution**: Your browser might be in dark mode. This is normal - colors adapt automatically!

### Text Too Small
**Problem**: Can't read text on mobile
**Solution**: Pinch to zoom (phones), or double-tap to zoom

---

## 📊 Sample Workflows

### Workflow 1: Student Checking Exam Schedule
```
1. Go to home page
2. Filter by category: "Exams"
3. Search for "schedule"
4. See relevant exams
5. Click notice for full schedule
6. Download attachment (schedule PDF)
7. Save notice by clicking heart
8. Done!
```

### Workflow 2: Finding Scholarships
```
1. Go to home page
2. Search for "scholarship"
3. Or filter by "Announcements" category
4. Click relevant notice
5. Read full scholarship details
6. Save notice
7. Go to /rag page
8. Ask AI: "How do I apply for scholarships?"
9. Get detailed information
10. Download relevant documents
```

### Workflow 3: New Student Getting Oriented
```
1. Go to /about to learn about system
2. Go to home page
3. Check "Announcements" for general info
4. Go to /rag page
5. Download "Student Handbook 2024"
6. Ask AI questions about campus
7. Sign up for account
8. Save useful notices
9. Done!
```

### Workflow 4: Checking Multiple Documents
```
1. Go to /rag page
2. See all documents in grid
3. Filter by category (e.g., "Academic")
4. Download course catalog
5. Ask AI: "What courses are available?"
6. Get smart response
7. Download other academic documents
8. Done!
```

---

## 📞 Getting Help

### Within the App
1. Click **About** in header → see how it works
2. Use search → find specific info
3. Ask AI → get answers to questions

### Documentation
- **README_NOTICEBOARD.md** - Full feature guide
- **PROJECT_STRUCTURE.md** - Code organization
- **QUICK_START.md** - Quick reference
- **IMPLEMENTATION_SUMMARY.md** - Technical details

### For Issues
1. Check troubleshooting section above
2. Try clearing browser cache
3. Try different browser
4. Check if localStorage is enabled

---

## 🎓 Learning Resources

### For Users
- Start with QUICK_START.md
- Try each feature once
- Read help within app

### For Developers
- Read PROJECT_STRUCTURE.md
- Review component code with comments
- Check IMPLEMENTATION_SUMMARY.md for architecture
- Edit mock-data.ts to add content

---

## 🚀 Advanced Usage

### For Deploying
1. Push code to GitHub
2. Go to vercel.com
3. Import repository
4. Deploy (1 click!)
5. Share live URL

### For Customizing
1. Clone or download code
2. Edit files as documented
3. Test locally with `pnpm dev`
4. Deploy when ready

### For Connecting Backend
1. Modify `lib/auth-context.tsx` for real auth
2. Update `lib/mock-data.ts` to fetch from API
3. Change fetch endpoints in components
4. Test and deploy

---

## 💡 Pro Tips

1. **Bookmark useful notices** - Click heart to save
2. **Combine filters** - Category + priority + search = perfect results
3. **Use Ctrl+F** - Search within modal content
4. **Ask AI specific questions** - Be precise for better answers
5. **Check "By" author** - See who posted the notice
6. **Note view counts** - More views = more popular/important
7. **Download attachments** - Some notices have detailed PDFs
8. **Read dates** - See when notice was published/updated

---

## ✨ Features Roadmap

### Current ✅
- Browse notices
- Search & filter
- View details
- Download documents
- AI Q&A
- Save notices
- Authentication

### Coming Soon 🚀
- Email notifications
- Export to PDF
- Calendar view
- Discussion threads
- Admin panel
- Advanced analytics
- Mobile app
- Real document processing

---

**You're all set!** 🎉

Start exploring NoticeBoard and enjoy the seamless experience!

Have questions? Check the documentation or ask the AI assistant!
