# 🚀 NoticeBoard - Quick Start Guide

## Get Started in 5 Minutes

### 1. Run the Project
```bash
pnpm dev
```
Open [http://localhost:3000](http://localhost:3000)

---

## 📍 Main Pages

| Page | URL | Purpose |
|------|-----|---------|
| **Home** | `/` | Browse all institutional notices |
| **Documents** | `/rag` | Access documents & AI Q&A |
| **Login** | `/login` | Sign in with credentials |
| **Sign Up** | `/signup` | Create new account |
| **About** | `/about` | Learn about the platform |

---

## 🎯 What You Can Do

### As a Guest (No Login)
✅ View all notices  
✅ Search and filter notices  
✅ Read full notice details  
✅ Download documents  
✅ Ask AI Q&A questions  

### After Signing In
✅ Everything above, plus:  
✅ Save favorite notices  
✅ Personalized experience  
✅ User profile  

---

## 🧪 Quick Tests

### Test 1: Search Notices
1. Go to home page
2. Type "exam" in search box
3. See filtered results

### Test 2: View Notice Details
1. Click any notice card
2. Modal opens showing full content
3. Click attachments to download
4. Click Save button

### Test 3: Ask AI Questions
1. Go to `/rag` page
2. Try asking: "What scholarships are available?"
3. Get AI response with sources

### Test 4: Try Authentication
1. Click "Sign Up" in header
2. Fill form with any details
3. You're logged in!
4. See your name in header
5. Click profile to logout

### Test 5: Test Filters
1. Go to home page
2. Select "Exams" category
3. Select "High" priority
4. Type "schedule"
5. See filtered results
6. Click "Clear Filters" to reset

---

## 📂 Quick File Guide

| File | What to Edit | When |
|------|-------------|------|
| `app/page.tsx` | Main page layout | Redesign home |
| `lib/mock-data.ts` | Notices & documents | Add content |
| `components/notices/notice-card.tsx` | Notice display | Change card design |
| `app/globals.css` | Colors & theme | Rebrand |
| `lib/auth-context.tsx` | Auth logic | Connect to backend |

---

## 🎨 Customize in 2 Minutes

### Change Primary Color
1. Open `app/globals.css`
2. Find `--primary: oklch(0.55 0.15 265)`
3. Change `265` to any hue value (0-360)
4. Save - colors update everywhere!

### Add Your Logo
1. Place logo image in `/public`
2. Open `components/layout/header.tsx`
3. Replace the "N" icon with your logo
4. Done!

### Change App Name
1. Open `app/layout.tsx`
2. Change `title: 'NoticeBoard'`
3. Find header component and update
4. Done!

---

## 🔐 Demo Login

```
Email: demo@example.com
Password: anything
```
(Any credentials work - this is a demo!)

---

## 📊 Data You Can See

### Notices
- 10 sample institutional notices
- Different categories and priorities
- Real-looking descriptions and content
- Attachment examples
- View counts

### Documents
- 4 institutional documents
- Realistic file sizes
- Categories: handbooks, guides, academic, financial

### AI Responses
- Smart responses about scholarships
- Campus facilities info
- Admission process
- Course information

---

## ⚡ Performance Tips

- ✅ Search is instant (runs on client)
- ✅ Filters update in real-time
- ✅ Images/icons are optimized SVG
- ✅ No backend = super fast!

---

## 🎯 Next Steps

1. **Explore**: Try all features on home page
2. **Customize**: Change colors to match your brand
3. **Add Content**: Edit mock-data.ts with real notices
4. **Deploy**: Push to GitHub → Deploy to Vercel
5. **Connect Backend**: Replace localStorage with real API

---

## 🆘 Troubleshooting

**Q: Search isn't working**
- A: Make sure you're typing in the search box on the left

**Q: I signed up but it doesn't remember me**
- A: Check browser localStorage is enabled (it is by default)

**Q: Modal isn't opening**
- A: Try clicking the notice card again, or refresh page

**Q: Colors look different**
- A: Browser might be in dark mode. Colors adapt automatically!

**Q: AI isn't responding**
- A: Try asking about scholarships, facilities, or admissions (those are implemented)

---

## 📱 Mobile Testing

Open DevTools → Toggle Device Toolbar → Select iPhone  
✅ Everything works on mobile!

---

## 🎓 Learn The Code

### Authentication
```typescript
// Use anywhere in your components
const { user, isAuthenticated, login, logout } = useAuth();
```

### Filter Notices
```typescript
const filteredNotices = useMemo(() => {
  return MOCK_NOTICES.filter(notice => {
    // Filter logic here
  })
}, [searchQuery, selectedCategory])
```

### Open Modal
```typescript
const [isModalOpen, setIsModalOpen] = useState(false)
<NoticeDetailModal 
  notice={selectedNotice} 
  isOpen={isModalOpen}
  onClose={() => setIsModalOpen(false)}
/>
```

---

## 🚀 Ready to Ship?

### Before Deployment
- [ ] Customize colors to match brand
- [ ] Replace dummy content with real data
- [ ] Test on mobile devices
- [ ] Test search and filters
- [ ] Test authentication flow

### Deploy Steps
1. Push to GitHub
2. Go to vercel.com
3. Import repository
4. Click Deploy
5. Share your live URL!

---

## 📞 Need Help?

1. Check `README_NOTICEBOARD.md` for full documentation
2. Look at `PROJECT_STRUCTURE.md` for architecture details
3. Read code comments in component files
4. Review `lib/mock-data.ts` to understand data structure

---

## 🎉 You're All Set!

Your fully functional NoticeBoard is ready. Customize it, deploy it, and enjoy! 🚀

**Happy coding!**
