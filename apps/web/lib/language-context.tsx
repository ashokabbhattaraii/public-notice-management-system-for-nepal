"use client"

import React, { createContext, useContext, useState, useEffect } from "react"

type Language = "en" | "ne"

interface LanguageContextType {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: string) => string
}

const translations: Record<Language, Record<string, string>> = {
  en: {
    "nav.home": "Home",
    "nav.notices": "Notices",
    "nav.about": "About",
    "nav.rag": "Documents",
    "nav.dashboard": "Dashboard",
    "nav.admin": "Admin",
    "nav.login": "Login",
    "nav.signup": "Sign Up",
    "nav.logout": "Logout",
    "hero.title": "Nepal's Official Public Notice Repository",
    "hero.subtitle": "Search, filter, and access authenticated government documents efficiently.",
    "hero.search": "Search notices, keywords, or reference numbers...",
    "notices.all": "All Notices",
    "notices.filter": "Filter",
    "notices.search": "Search",
    "notices.category": "Category",
    "notices.priority": "Priority",
    "notices.views": "views",
    "dashboard.welcome": "Welcome back",
    "dashboard.saved": "Saved Notices",
    "dashboard.alerts": "My Alerts",
    "dashboard.activity": "Recent Activity",
    "admin.dashboard": "Admin Dashboard",
    "admin.notices": "Manage Notices",
    "admin.users": "Manage Users",
    "admin.categories": "Categories",
    "admin.scraping": "Web Scraping",
    "admin.system": "System Settings",
    "common.save": "Save",
    "common.cancel": "Cancel",
    "common.delete": "Delete",
    "common.edit": "Edit",
    "common.create": "Create",
    "common.back": "Back",
  },
  ne: {
    "nav.home": "गृहपृष्ठ",
    "nav.notices": "सूचनाहरू",
    "nav.about": "बारेमा",
    "nav.rag": "कागजातहरू",
    "nav.dashboard": "ड्यासबोर्ड",
    "nav.admin": "प्रशासन",
    "nav.login": "लगइन",
    "nav.signup": "दर्ता",
    "nav.logout": "लगआउट",
    "hero.title": "नेपालको आधिकारिक सार्वजनिक सूचना भण्डार",
    "hero.subtitle": "प्रमाणित सरकारी कागजातहरू खोज्नुहोस्, फिल्टर गर्नुहोस् र पहुँच गर्नुहोस्।",
    "hero.search": "सूचना, कुञ्जी शब्द, वा सन्दर्भ नम्बर खोज्नुहोस्...",
    "notices.all": "सबै सूचनाहरू",
    "notices.filter": "फिल्टर",
    "notices.search": "खोज",
    "notices.category": "वर्ग",
    "notices.priority": "प्राथमिकता",
    "notices.views": "हेराइहरू",
    "dashboard.welcome": "स्वागत छ",
    "dashboard.saved": "सुरक्षित सूचनाहरू",
    "dashboard.alerts": "मेरा अलर्टहरू",
    "dashboard.activity": "हालको गतिविधि",
    "admin.dashboard": "प्रशासन ड्यासबोर्ड",
    "admin.notices": "सूचना व्यवस्थापन",
    "admin.users": "प्रयोगकर्ता व्यवस्थापन",
    "admin.categories": "वर्गहरू",
    "admin.scraping": "वेब स्क्र्यापिङ",
    "admin.system": "प्रणाली सेटिङ",
    "common.save": "सुरक्षित",
    "common.cancel": "रद्द",
    "common.delete": "मेटाउनुहोस्",
    "common.edit": "सम्पादन",
    "common.create": "सिर्जना",
    "common.back": "पछाडि",
  },
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en")

  useEffect(() => {
    const stored = localStorage.getItem("pnm_language") as Language
    if (stored && (stored === "en" || stored === "ne")) {
      setLanguageState(stored)
    }
  }, [])

  const setLanguage = (lang: Language) => {
    setLanguageState(lang)
    localStorage.setItem("pnm_language", lang)
  }

  const t = (key: string): string => {
    return translations[language][key] || key
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) throw new Error("useLanguage must be used within LanguageProvider")
  return context
}
