# Quick Start - UI Version 3

## Run the Application

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000)

## What You'll See

### 1. First Thing: Header with Controls
- **Logo**: Nepal Notices branding on left
- **Navigation**: Notices, Documents, About links
- **Theme Toggle**: Sun/Moon icon (click to switch dark mode)
- **Language Switch**: Globe icon (English/नेपाली)
- **Notifications**: Bell icon with notification dot
- **Auth**: Login/Sign up buttons or user profile

### 2. Main Content: Clean Interface
- **Title**: "Government Notices" with description
- **Search Bar**: Large rounded search box at top
  - Placeholder: "Search notices by title, content, or organization..."
  - Real-time filtering as you type
  - Clear button (X) when text entered

### 3. Filter Pills
- **Category Row**: All • Exams • Vacancies & Admissions • Tenders • Policy Updates • Announcements
- **Priority Row**: All • High Priority • Normal • Low Priority
- All buttons light up when selected
- Click to filter, click again to deselect

### 4. Notices List
- **Staggered Animations**: Cards fade in with delay
- **Notice Cards** showing:
  - Organization name
  - Title (line-clamped to 2 lines)
  - Category + Priority badge
  - Description preview
  - Deadline with countdown
  - Author and date
  - Save button (heart icon)
  - View count

### 5. Interactions
- **Hover Cards**: Scale up, shadow enhances, text color changes
- **Click Card**: Opens detail modal
- **Save Button**: Heart fills and scales when clicked
- **Filter Buttons**: Active state shows with primary purple color
- **Search**: Type to filter across title, description, organization
- **Theme Toggle**: Instantly switches between light and dark
- **Language**: Foundation ready (currently shows English/Nepali options)

## Key Features

### Animations
- Page load: Staggered fade-in animations
- Cards: Hover effects with scale and shadow
- Icons: Rotate and scale on hover
- Buttons: Smooth color transitions
- Theme: Instant switch with smooth transitions

### Dark Mode
- Click sun/moon icon in header
- Theme persists across sessions
- All colors optimized for both modes
- Smooth transition between modes

### Language
- Click globe icon in header
- Current options: English, नेपाली
- Foundation for adding more languages

### Responsive Design
- Mobile: Stacked layout, full-width buttons
- Tablet: Optimized spacing
- Desktop: Full multi-column layout

## Interaction Guide

### Filter by Category
```
Click "Vacancies & Admissions" pill
→ Shows only vacancy notices
→ Count updates showing filtered results
```

### Filter by Priority
```
Click "High Priority" pill
→ Shows only high-priority notices
→ Badge shows selection state
```

### Search
```
Type "exam" in search box
→ Filters in real-time
→ Shows all matches across title, description, organization
→ X button appears to clear search
```

### Save a Notice
```
Hover over notice card
→ Heart icon is visible on right
→ Click heart icon
→ Icon fills with color and scales up
→ Notice is marked as saved
```

### Switch Theme
```
Click sun/moon icon in header
→ Entire page transitions to dark/light mode
→ All colors adjust automatically
→ Preference saved in browser
```

### Change Language
```
Click globe icon in header
→ Dropdown shows English and नेपाली options
→ Select language (foundation ready)
```

## File Locations

- **Home Page**: `/app/page.tsx`
- **Header**: `/components/layout/header.tsx`
- **Filters**: `/components/notices/notice-filters.tsx`
- **Notice Card**: `/components/notices/notice-card.tsx`
- **Styles**: `/app/globals.css`
- **Layout**: `/app/layout.tsx`

## Color Scheme

### Purple Theme
- **Primary**: `oklch(0.52 0.2 280)` - Deep purple
- **Accent**: `oklch(0.68 0.2 320)` - Magenta pink
- **Light Mode**: White background, dark text
- **Dark Mode**: Deep background, light text

## Performance Notes

- Animations use GPU acceleration (transform, opacity)
- 60fps smooth animations
- Fast theme switching
- Optimized image rendering
- Clean CSS without heavy computations

## Customization

### Change Primary Color
Edit `/app/globals.css`:
```css
--primary: oklch(0.52 0.2 280);  /* Change this */
```

### Change Animation Speed
Edit animation in `/app/page.tsx`:
```tsx
className="animate-in fade-in duration-500"  /* Change 500 to desired ms */
```

### Add More Languages
Edit `/components/layout/header.tsx`:
```tsx
const languages = {
  'en': 'English',
  'ne': 'नेपाली',
  'hi': 'हिन्दी',  // Add more
};
```

## Troubleshooting

**Dark mode not working?**
- Clear browser cache
- Check if `next-themes` is installed
- Verify ThemeProvider in layout.tsx

**Animations not smooth?**
- Check browser hardware acceleration
- Verify CSS animations in globals.css
- Try different browser

**Language switch not working?**
- Currently foundation only - full i18n requires setup
- Click to verify dropdown appears

## Next Steps

1. ✅ Run the app with `pnpm dev`
2. ✅ Try clicking filter pills
3. ✅ Type in search to filter
4. ✅ Toggle dark mode (sun/moon icon)
5. ✅ Try language switch
6. ✅ Hover over cards to see animations
7. ✅ Click heart to save notices
8. ✅ Click notice to see details

---

**Everything is ready to use immediately!** 🚀
