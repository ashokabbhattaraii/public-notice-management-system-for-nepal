---
version: alpha
name: "Vezigno Modern"
description: "Typography baseline relies on Poppins, sans-serif for largest hero display heading — full-width statement text."
colors:
  deep-navy-primary: "#101d23"
  sky-blue-secondary: "#a2c5d3"
  surface-light: "#f5f5f5"
  white: "#ffffff"
  text-primary: "#333333"
  text-secondary: "#666666"
  border-subtle: "#e5e7eb"
typography:
  display-hero:
    fontFamily: "Poppins, sans-serif"
    fontSize: "96px"
    fontWeight: "400"
    lineHeight: "112px"
    letterSpacing: "-3.84px"
  heading-large:
    fontFamily: "Poppins, sans-serif"
    fontSize: "64px"
    fontWeight: "400"
    lineHeight: "72px"
    letterSpacing: "-2.56px"
  heading-medium:
    fontFamily: "Poppins, sans-serif"
    fontSize: "36px"
    fontWeight: "400"
    lineHeight: "47.99px"
  heading-small:
    fontFamily: "Poppins, sans-serif"
    fontSize: "24px"
    fontWeight: "400"
    lineHeight: "30px"
  body:
    fontFamily: "Poppins, sans-serif"
    fontSize: "16px"
    fontWeight: "400"
    lineHeight: "24px"
  label-small:
    fontFamily: "Poppins, sans-serif"
    fontSize: "10px"
    fontWeight: "400"
    lineHeight: "10px"
rounded:
  radius-sm: "12px"
  radius-md: "20px"
  radius-lg: "24px"
  radius-pill: "100px"
  radius-full: "1000px"
spacing:
  space-1: "8px"
  space-2: "12px"
  space-3: "16px"
  space-4: "24px"
  space-5: "28px"
  space-6: "32px"
  space-7: "40px"
  space-8: "48px"
  space-9: "64px"
  space-10: "72px"
  space-11: "80px"
  space-12: "200px"
  hero-top-padding: "220px"
components:
  brand:
    textColor: "{colors.text-primary}"
    backgroundColor: "rgba(0, 0, 0, 0)"
    padding: "0px"
    fontSize: "16px"
    fontWeight: "400"
  button-primary:
    backgroundColor: "{colors.deep-navy-primary}"
    textColor: "{colors.white}"
    rounded: "{rounded.radius-pill}"
    padding: "12px 24px"
    fontSize: "16px"
    boxShadow: "none"
  hero:
    padding: "220px 0px 0px"
    backgroundColor: "rgba(0, 0, 0, 0)"
    boxShadow: "none"
    fontSize: "16px"
    textColor: "{colors.text-primary}"
  navigation:
    padding: "24px 0px"
    backgroundColor: "rgba(162, 197, 211, 0)"
    rounded: "0px"
    boxShadow: "none"
    fontSize: "16px"
    textColor: "{colors.text-primary}"
  navigation-nav-menu-pill:
    backgroundColor: "rgba(255, 255, 255, 0.1)"
    rounded: "{rounded.radius-pill}"
    padding: "{spacing.space-1}"
    boxShadow: "none"
  preview-card:
    rounded: "24px 24px 0px 0px"
    boxShadow: "none"
    overflow: "hidden"
  typography-h1-display:
    fontSize: "96px"
    fontWeight: "400"
    lineHeight: "112px"
    letterSpacing: "-3.84px"
    textColor: "{colors.text-primary}"
    fontFamily: "Poppins, sans-serif"
  typography-h1-large-section:
    fontSize: "64px"
    fontWeight: "400"
    lineHeight: "{spacing.space-10}"
    letterSpacing: "-2.56px"
    textColor: "{colors.text-primary}"
    fontFamily: "Poppins, sans-serif"
---

## Overview

Typography baseline relies on Poppins, sans-serif for largest hero display heading — full-width statement text.

This system uses a 8px base grid with scale values 1, 1.5, 2, 3, 3.5, 4, 5, 6, 8, 9, 10, 25, 27.5.

**Signature traits:**
- Core token rhythm: Token evidence indicates consistent color, spacing, and radius rhythm across visible UI.

## Colors

The palette uses 7 validated color tokens across 1 theme profile. Semantic roles stay attached to observed usage so generation agents can choose accents without inventing new color meaning.

**Semantic naming:**
- **content-text** maps to `text-primary`: Role "text" is grounded by usage context "Primary body and heading text across all zones; dominant color at 506 hits".
- **action-background** maps to `sky-blue-secondary`: Role "background" is grounded by usage context "Hero background surface, secondary brand accent, link and border usage in footer".
- **border-border** maps to `border-subtle`: Role "border" is grounded by usage context "Subtle dividers and hairline borders".
- **surface-background** maps to `surface-light`: Role "background" is grounded by usage context "Light section backgrounds, alternate surface fills".

### Text Scale
- **Text Primary** (#333333): Primary body and heading text across all zones; dominant color at 506 hits. Role: text. {authored: rgb(51, 51, 51), space: rgb}
- **Text Secondary** (#666666): Secondary/muted body text, captions, footer text. Role: text. {authored: rgb(102, 102, 102), space: rgb}

### Interactive
- **Border Subtle** (#e5e7eb): Subtle dividers and hairline borders. Role: border. {authored: rgb(229, 231, 235), space: rgb}

### Surface & Shadows
- **Deep Navy Primary** (#101d23): Primary CTA button background ('Buy template'), key action surfaces. Role: background. {authored: rgb(16, 29, 35), space: rgb}
- **Sky Blue Secondary** (#a2c5d3): Hero background surface, secondary brand accent, link and border usage in footer. Role: background. {authored: rgb(162, 197, 211), space: rgb, alpha: 0}
- **Surface Light** (#f5f5f5): Light section backgrounds, alternate surface fills. Role: background. {authored: rgb(245, 245, 245), space: rgb}
- **White** (#ffffff): Surface background for cards, nav pill fill, reversed text on dark CTA. Role: background. {authored: rgb(255, 255, 255), space: rgb, alpha: 0.1}

## Typography

Typography uses Poppins, sans-serif across extracted hierarchy roles. Keep hierarchy mapped to these token rows before adding decorative type styles.

Uses Poppins, sans-serif throughout for a uniform feel. Sizes range from 10px to 96px.

### Font Roles
- **Headline Font**: Poppins
- **Body Font**: Poppins

### Type Scale Evidence
| Role | Font | Size | Weight | Line Height | Letter Spacing | Stack / Features | Notes |
|------|------|------|--------|-------------|----------------|------------------|-------|
| Largest hero display heading — full-width statement text | Poppins, sans-serif | 96px | 400 | 112px | -3.84px | Poppins, sans-serif | Extracted token |
| Primary section headings and page titles | Poppins, sans-serif | 64px | 400 | 72px | -2.56px | Poppins, sans-serif | Extracted token |
| Sub-section headings and card titles | Poppins, sans-serif | 36px | 400 | 47.99px | normal | Poppins, sans-serif | Extracted token |
| Tertiary headings, feature labels, card subtitles | Poppins, sans-serif | 24px | 400 | 30px | normal | Poppins, sans-serif | Extracted token |
| Primary body copy, navigation links, UI labels | Poppins, sans-serif | 16px | 400 | 24px | normal | Poppins, sans-serif | Extracted token |
| Micro-labels, tags, badges | Poppins, sans-serif | 10px | 400 | 10px | normal | Poppins, sans-serif | Extracted token |

## Layout

Responsive system uses 1 breakpoint tier(s): tablet.

### Responsive Strategy
- **tablet (768-991px)**: Increase spacing and column structure for medium-width viewports.

### Spacing System
| Token | Value | Px | Notes |
|------|-------|----|-------|
| space-1 | 8px | 8 | Extracted spacing token |
| space-2 | 12px | 12 | Extracted spacing token |
| space-3 | 16px | 16 | Extracted spacing token |
| space-4 | 24px | 24 | Extracted spacing token |
| space-5 | 28px | 28 | Extracted spacing token |
| space-6 | 32px | 32 | Extracted spacing token |
| space-7 | 40px | 40 | Extracted spacing token |
| space-8 | 48px | 48 | Extracted spacing token |
| space-9 | 64px | 64 | Extracted spacing token |
| space-10 | 72px | 72 | Extracted spacing token |
| space-11 | 80px | 80 | Extracted spacing token |
| space-12 | 200px | 200 | Extracted spacing token |
| hero-top-padding | 220px | 220 | Extracted spacing token |

## Elevation & Depth

Keep depth flat unless validated shadow or interaction evidence appears in the extraction payload. Do not invent shadows beyond this evidence boundary.

### Shadow Evidence
| Shadow Token | Layers | Details |
|--------------|--------|---------|
| n/a | 0 | No validated shadow payload |

### Interaction Signals
| Theme | Signal | Evidence |
|-------|--------|----------|
| Light | backdrop-filter | blur(6px) |
| Light | outline-color | rgb(51, 51, 51) ; rgb(255, 255, 255) ; rgb(102, 102, 102) |
| Light | outline-width | 3px |
| Light | outline-offset | 0px |
| Light | transform | matrix(1, 0, 0, 1, 0, 0) ; matrix(1, 0, 0, 1, 0, 32) ; matrix(0.809017, 0.587785, -0.587785, 0.809017, 0, 0) |

## Shapes

Shape language maps directly to rounded tokens. Keep component corners consistent with the role mapping below before introducing bespoke geometry.

### Radius Roles
| Token | Value | Px | Role Mapping |
|------|-------|----|--------------|
| radius-sm | 12px | 12 | Control corner |
| radius-md | 20px | 20 | Card corner |
| radius-lg | 24px | 24 | Large surface corner |
| radius-pill | 100px | 100 | Large surface corner |
| radius-full | 1000px | 1000 | Large surface corner |

### Geometry Evidence
| Radius Token | Shape | Units |
|--------------|-------|-------|
| radius-sm | 12px | px |
| radius-md | 20px | px |
| radius-lg | 24px | px |
| radius-pill | 100px | px |
| radius-full | 1000px | px |

## Components

Components should be recreated from token references first, then tuned with variant notes and probe-backed state guidance.
- **Navigation Bar**: Full-width top navigation with brand logo on the left, pill-shaped frosted nav menu in the center, and CTA button on the right. No border or shadow — floats over hero.
- **CTA Button**: Primary call-to-action button with deep navy background, white text, pill shape, and an arrow icon. Used in the top-right nav for 'Buy template'.
- **Hero Section**: Full-viewport hero with sky-blue gradient/surface background, oversized display heading, and a preview of the template below the fold.
- **Display Heading**: Oversized display heading used as the primary hero statement. Weight 400 (regular) at 96px with tight negative letter-spacing.
- **Brand Logo Link**: Text-based brand mark in the top-left of the navigation. White text on the hero, inherits #333333 on light backgrounds.
- **Template Preview Card**: Rounded card showing a preview of the inner template design, partially visible below the hero fold. Uses rounded corners and sits on the sky-blue hero surface.

### Brand

**Default**
- textColor: #333333
- backgroundColor: rgba(0, 0, 0, 0)
- padding: 0px
- fontSize: 16px
- fontWeight: 400
- State guidance: Probe-confirmed a.brand: color #333333, no background, no border, no shadow, padding 0px.

### Button

**Primary**
- backgroundColor: #101d23
- textColor: #ffffff
- rounded: 100px
- padding: 12px 24px
- fontSize: 16px
- boxShadow: none
- State guidance: Deep navy #101d23 background, white text, pill radius (100px), no shadow. Arrow icon (↗) appended to label.

### Hero

**Default**
- padding: 220px 0px 0px
- backgroundColor: rgba(0, 0, 0, 0)
- boxShadow: none
- fontSize: 16px
- textColor: #333333
- State guidance: Probe-confirmed: padding 220px 0px 0px, transparent background (sky-blue comes from parent/body), no shadow, no border.

### Navigation

**Default**
- padding: 24px 0px
- backgroundColor: rgba(162, 197, 211, 0)
- rounded: 0px
- boxShadow: none
- fontSize: 16px
- textColor: #333333
- State guidance: Probe-confirmed: padding 24px 0px, transparent background, no border, no shadow. Nav menu pill uses rgba(255,255,255,0.1) fill with 100px border-radius and 8px padding.

**Nav Menu Pill**
- backgroundColor: rgba(255, 255, 255, 0.1)
- rounded: 100px
- padding: 8px
- boxShadow: none
- State guidance: Center pill container: rgba white fill, 100px radius, 8px padding — creates frosted pill effect over hero background.

### Preview Card

**Default**
- rounded: 24px 24px 0px 0px
- boxShadow: none
- overflow: hidden
- State guidance: Visually confirmed from screenshot: rounded top corners (~24px), no visible shadow, white/light card surface.

### Typography

**H1 Display**
- fontSize: 96px
- fontWeight: 400
- lineHeight: 112px
- letterSpacing: -3.84px
- textColor: #333333
- fontFamily: Poppins, sans-serif
- State guidance: Probe-confirmed h1.style-heading-large: 96px, weight 400, color #333333, no background, no shadow.

**H1 Large Section**
- fontSize: 64px
- fontWeight: 400
- lineHeight: 72px
- letterSpacing: -2.56px
- textColor: #333333
- fontFamily: Poppins, sans-serif
- State guidance: 64px variant used for section-level headings, same weight 400 convention.

## Do's and Don'ts

Guardrails protect Core token rhythm without adding unsupported visual claims.

| Do | Don't |
|----|---------|
| Do maintain consistent spacing using the base grid | Don't make unsupported claims about absent visual features |
| Do maintain WCAG AA contrast ratios (4.5:1 for normal text) | Don't mix rounded and sharp corners in the same view |
| Do use the primary color only for the single most important action per screen |  |
| Do verify evidence before writing new design-system guidance |  |

## Responsive Evidence

### Breakpoints
| Name | Width | Key Changes |
|------|-------|-------------|
| Tablet | 768-991px | (max-width: 991px) and (min-width: 768px) |
| Tablet | >= 992px | (min-width: 992px) |

## Agent Prompt Guide

### Example Component Prompts
- Create Brand Logo Link variant that preserves Text-based brand mark in the top-left of the navigation. White text on the hero, inherits #333333 on light backgrounds..
- Create CTA Button variant that preserves Primary call-to-action button with deep navy background, white text, pill shape, and an arrow icon. Used in the top-right nav for 'Buy template'..
- Create Display Heading variant that preserves Oversized display heading used as the primary hero statement. Weight 400 (regular) at 96px with tight negative letter-spacing..

### Iteration Guide
1. Start with extracted palette and typography roles only.
2. Map spacing and radius directly from token tables before visual polish.
3. Apply component patterns one section at a time and compare against source intent.
4. Keep elevation claims tied to explicit evidence in output.
5. Iterate with smallest diffs and re-check section hierarchy after each change.




:root {
  /* Colors */
  --color-text-primary: #333333;
  --color-sky-blue-secondary: #a2c5d3;
  --color-white: #ffffff;
  --color-deep-navy-primary: #101d23;
  --color-text-secondary: #666666;
  --color-border-subtle: #e5e7eb;
  --color-surface-light: #f5f5f5;

  /* Typography */
  --font-display-hero-family: Poppins, sans-serif;
  --font-display-hero-size: 96px;
  --font-display-hero-weight: 400;
  --font-display-hero-line-height: 112px;
  --font-display-hero-letter-spacing: -3.84px;
  --font-heading-large-family: Poppins, sans-serif;
  --font-heading-large-size: 64px;
  --font-heading-large-weight: 400;
  --font-heading-large-line-height: 72px;
  --font-heading-large-letter-spacing: -2.56px;
  --font-heading-medium-family: Poppins, sans-serif;
  --font-heading-medium-size: 36px;
  --font-heading-medium-weight: 400;
  --font-heading-medium-line-height: 47.99px;
  --font-heading-small-family: Poppins, sans-serif;
  --font-heading-small-size: 24px;
  --font-heading-small-weight: 400;
  --font-heading-small-line-height: 30px;
  --font-body-family: Poppins, sans-serif;
  --font-body-size: 16px;
  --font-body-weight: 400;
  --font-body-line-height: 24px;
  --font-label-small-family: Poppins, sans-serif;
  --font-label-small-size: 10px;
  --font-label-small-weight: 400;
  --font-label-small-line-height: 10px;

  /* Spacing */
  --spacing-space-1: 8px;
  --spacing-space-2: 12px;
  --spacing-space-3: 16px;
  --spacing-space-4: 24px;
  --spacing-space-5: 28px;
  --spacing-space-6: 32px;
  --spacing-space-7: 40px;
  --spacing-space-8: 48px;
  --spacing-space-9: 64px;
  --spacing-space-10: 72px;
  --spacing-space-11: 80px;
  --spacing-space-12: 200px;
  --spacing-hero-top-padding: 220px;

  /* Border Radius */
  --radius-radius-sm: 12px;
  --radius-radius-md: 20px;
  --radius-radius-lg: 24px;
  --radius-radius-pill: 100px;
  --radius-radius-full: 1000px;

}



{
  "color": {
    "Text Primary": {
      "$type": "color",
      "$value": "#333333",
      "$description": "Primary body and heading text across all zones; dominant color at 506 hits"
    },
    "Sky Blue Secondary": {
      "$type": "color",
      "$value": "#a2c5d3",
      "$description": "Hero background surface, secondary brand accent, link and border usage in footer"
    },
    "White": {
      "$type": "color",
      "$value": "#ffffff",
      "$description": "Surface background for cards, nav pill fill, reversed text on dark CTA"
    },
    "Deep Navy Primary": {
      "$type": "color",
      "$value": "#101d23",
      "$description": "Primary CTA button background ('Buy template'), key action surfaces"
    },
    "Text Secondary": {
      "$type": "color",
      "$value": "#666666",
      "$description": "Secondary/muted body text, captions, footer text"
    },
    "Border Subtle": {
      "$type": "color",
      "$value": "#e5e7eb",
      "$description": "Subtle dividers and hairline borders"
    },
    "Surface Light": {
      "$type": "color",
      "$value": "#f5f5f5",
      "$description": "Light section backgrounds, alternate surface fills"
    }
  },
  "typography": {
    "Display Hero": {
      "$type": "typography",
      "$value": {
        "fontFamily": "Poppins, sans-serif",
        "fontSize": "96px",
        "fontWeight": 400,
        "lineHeight": "112px",
        "letterSpacing": "-3.84px"
      },
      "$description": "Largest hero display heading — full-width statement text"
    },
    "Heading Large": {
      "$type": "typography",
      "$value": {
        "fontFamily": "Poppins, sans-serif",
        "fontSize": "64px",
        "fontWeight": 400,
        "lineHeight": "72px",
        "letterSpacing": "-2.56px"
      },
      "$description": "Primary section headings and page titles"
    },
    "Heading Medium": {
      "$type": "typography",
      "$value": {
        "fontFamily": "Poppins, sans-serif",
        "fontSize": "36px",
        "fontWeight": 400,
        "lineHeight": "47.99px",
        "letterSpacing": "normal"
      },
      "$description": "Sub-section headings and card titles"
    },
    "Heading Small": {
      "$type": "typography",
      "$value": {
        "fontFamily": "Poppins, sans-serif",
        "fontSize": "24px",
        "fontWeight": 400,
        "lineHeight": "30px",
        "letterSpacing": "normal"
      },
      "$description": "Tertiary headings, feature labels, card subtitles"
    },
    "Body": {
      "$type": "typography",
      "$value": {
        "fontFamily": "Poppins, sans-serif",
        "fontSize": "16px",
        "fontWeight": 400,
        "lineHeight": "24px",
        "letterSpacing": "normal"
      },
      "$description": "Primary body copy, navigation links, UI labels"
    },
    "Label Small": {
      "$type": "typography",
      "$value": {
        "fontFamily": "Poppins, sans-serif",
        "fontSize": "10px",
        "fontWeight": 400,
        "lineHeight": "10px",
        "letterSpacing": "normal"
      },
      "$description": "Micro-labels, tags, badges"
    }
  },
  "spacing": {
    "space-1": {
      "$type": "dimension",
      "$value": "8px"
    },
    "space-2": {
      "$type": "dimension",
      "$value": "12px"
    },
    "space-3": {
      "$type": "dimension",
      "$value": "16px"
    },
    "space-4": {
      "$type": "dimension",
      "$value": "24px"
    },
    "space-5": {
      "$type": "dimension",
      "$value": "28px"
    },
    "space-6": {
      "$type": "dimension",
      "$value": "32px"
    },
    "space-7": {
      "$type": "dimension",
      "$value": "40px"
    },
    "space-8": {
      "$type": "dimension",
      "$value": "48px"
    },
    "space-9": {
      "$type": "dimension",
      "$value": "64px"
    },
    "space-10": {
      "$type": "dimension",
      "$value": "72px"
    },
    "space-11": {
      "$type": "dimension",
      "$value": "80px"
    },
    "space-12": {
      "$type": "dimension",
      "$value": "200px"
    },
    "hero-top-padding": {
      "$type": "dimension",
      "$value": "220px"
    }
  },
  "borderRadius": {
    "radius-sm": {
      "$type": "dimension",
      "$value": "12px"
    },
    "radius-md": {
      "$type": "dimension",
      "$value": "20px"
    },
    "radius-lg": {
      "$type": "dimension",
      "$value": "24px"
    },
    "radius-pill": {
      "$type": "dimension",
      "$value": "100px"
    },
    "radius-full": {
      "$type": "dimension",
      "$value": "1000px"
    }
  }
}



@theme {
  /* Colors */
  --color-text-primary: #333333;
  --color-sky-blue-secondary: #a2c5d3;
  --color-white: #ffffff;
  --color-deep-navy-primary: #101d23;
  --color-text-secondary: #666666;
  --color-border-subtle: #e5e7eb;
  --color-surface-light: #f5f5f5;

  /* Spacing */
  --spacing-space-1: 8px;
  --spacing-space-2: 12px;
  --spacing-space-3: 16px;
  --spacing-space-4: 24px;
  --spacing-space-5: 28px;
  --spacing-space-6: 32px;
  --spacing-space-7: 40px;
  --spacing-space-8: 48px;
  --spacing-space-9: 64px;
  --spacing-space-10: 72px;
  --spacing-space-11: 80px;
  --spacing-space-12: 200px;
  --spacing-hero-top-padding: 220px;

  /* Border Radius */
  --radius-radius-sm: 12px;
  --radius-radius-md: 20px;
  --radius-radius-lg: 24px;
  --radius-radius-pill: 100px;
  --radius-radius-full: 1000px;

  /* Fonts */
  --font-poppins: "Poppins", sans-serif;

}


