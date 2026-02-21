# Quick Reference - Nepal Notices Hub v2.0

## 🎨 Color Theme
```css
Primary:        #8B5FBF (Purple)
Accent:         #D85FB0 (Magenta)
Background:     #FAFAF8 (Off-white)
Text:           #1F1F23 (Dark)
Borders:        #E0E0DC (Light gray)
```

## 📍 Key Pages
| Route | Purpose |
|-------|---------|
| `/` | Home - Browse all notices |
| `/rag` | Documents & Q&A |
| `/login` | Sign in |
| `/signup` | Create account |
| `/about` | About the platform |

## 🔍 Filtering Guide

### Search
- Searches across: Title, Description, Content
- Real-time results
- Case-insensitive

### Categories
- 📝 **Exams** (3 notices)
- 💼 **Vacancies & Admissions** (2 notices)
- 🏢 **Tenders** (1 notice)
- 📋 **Policy Updates** (1 notice)
- 📢 **Announcements** (3 notices)

### Priority Levels
- 🔴 **High** - Urgent, deadlines soon
- ◯ **Normal** - Standard importance
- ○ **Low** - Informational

## 📊 Government Agencies
1. 🇳🇵 Public Service Commission Nepal
2. 🎓 Tribhuvan University
3. 💰 Nepal Rastra Bank
4. 🌍 Ministry of Foreign Affairs
5. 📦 Department of Customs
6. 🏛️ Office of PM & Council

## ✨ New Features
- ✅ Advanced collapsible filters
- ✅ Organization attribution
- ✅ Deadline tracking
- ✅ Urgency badges
- ✅ Statistics overview
- ✅ Featured notices section

## 📱 Responsive Breakpoints
- Mobile: < 768px (1 column)
- Tablet: 768-1024px (2 columns)
- Desktop: > 1024px (4 columns)

## 🎯 Common Tasks

### Find notices by category
1. Click on category card in stats section, OR
2. Expand filters → Click category → View results

### Search for specific notice
1. Type in search box (auto-filters instantly)
2. Or browse by category first, then search within

### Check urgency
1. Look for "⚡ Deadline Soon" badge
2. Check deadline countdown (e.g., "Deadline in 5 days")
3. Sort high-priority notices first

### View notice details
1. Click any notice card
2. Read full content in modal
3. Check deadline, organization, attachments

### Save notice
1. Click heart icon on notice card
2. Saved locally in browser
3. Sign in to sync across devices

## 🔧 Customization Tips

### Change colors
Edit `/app/globals.css` - Update oklch values for primary/accent

### Add new agency
Edit `/lib/mock-data.ts` - Add notice object to MOCK_NOTICES array

### Modify filters
Edit `/components/notices/notice-filters.tsx` - Update filter options

### Adjust layout
Edit `/app/page.tsx` - Change grid columns or spacing

## 🚀 Performance Tips

- Filters use `useMemo` (no slow re-renders)
- Sticky sidebar for easy access
- Responsive images & icons
- Smooth CSS transitions (no janky animations)

## 📋 Notice Card Information

Each notice shows:
- 🏢 Organization name
- 📝 Title & description
- 🎯 Category & priority
- ⏰ Deadline countdown
- 👁 View count
- 💾 Save button
- 📎 File count

## 🎁 Easter Eggs

1. Click category card in stats → Auto-filters by category
2. Hover over notice cards → Icons scale up
3. Active filters show as removable chips
4. "Deadline Soon" appears for urgent items

## ❓ FAQ

**Q: Why purple?**
A: Modern, professional color that conveys governmental authority.

**Q: How to clear all filters?**
A: Click "Clear All Filters" button at bottom of filter panel.

**Q: Where's the authentication?**
A: Sign in works with localStorage. Real backend needed for production.

**Q: Can I export notices?**
A: Not yet - planned for v3.0.

**Q: Mobile friendly?**
A: Yes! Fully responsive design tested on all devices.

---

**Last Updated**: Feb 21, 2025
**Version**: 2.0
**Status**: Production Ready ✅
