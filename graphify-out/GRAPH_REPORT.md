# Graph Report - .  (2026-06-25)

## Corpus Check
- 118 files · ~93,101 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 772 nodes · 1664 edges · 46 communities (43 shown, 3 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 21 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Chat & Proposals UI|Chat & Proposals UI]]
- [[_COMMUNITY_WDSF Profile & Competition Analytics|WDSF Profile & Competition Analytics]]
- [[_COMMUNITY_About App Screen|About App Screen]]
- [[_COMMUNITY_Server Dependencies|Server Dependencies]]
- [[_COMMUNITY_WDSF Scraper Library|WDSF Scraper Library]]
- [[_COMMUNITY_Mobile Dependencies|Mobile Dependencies]]
- [[_COMMUNITY_Side Drawer Navigation|Side Drawer Navigation]]
- [[_COMMUNITY_Activity Log & Couple Members|Activity Log & Couple Members]]
- [[_COMMUNITY_App Config (app.json)|App Config (app.json)]]
- [[_COMMUNITY_Session Form & Display Utils|Session Form & Display Utils]]
- [[_COMMUNITY_Finance Dashboard Charts|Finance Dashboard Charts]]
- [[_COMMUNITY_Email & Environment Config|Email & Environment Config]]
- [[_COMMUNITY_Auth & Validation Layer|Auth & Validation Layer]]
- [[_COMMUNITY_Project Documentation|Project Documentation]]
- [[_COMMUNITY_i18n & Theme State|i18n & Theme State]]
- [[_COMMUNITY_Server TypeScript Config|Server TypeScript Config]]
- [[_COMMUNITY_Expense Routes & DB Seed|Expense Routes & DB Seed]]
- [[_COMMUNITY_Finance Dashboard & Expenses Tab|Finance Dashboard & Expenses Tab]]
- [[_COMMUNITY_HTTP Utils & Budget Routes|HTTP Utils & Budget Routes]]
- [[_COMMUNITY_Calendar & Schedule Tab|Calendar & Schedule Tab]]
- [[_COMMUNITY_Projects & Events|Projects & Events]]
- [[_COMMUNITY_Category Donut & Checklist|Category Donut & Checklist]]
- [[_COMMUNITY_File Upload & Validation|File Upload & Validation]]
- [[_COMMUNITY_Expense Form Modal|Expense Form Modal]]
- [[_COMMUNITY_Real-time Notifications & Schedule API|Real-time Notifications & Schedule API]]
- [[_COMMUNITY_Mobile App Branding Assets|Mobile App Branding Assets]]
- [[_COMMUNITY_Localization (i18n Strings)|Localization (i18n Strings)]]
- [[_COMMUNITY_JWT & WebSocket Auth|JWT & WebSocket Auth]]
- [[_COMMUNITY_Progress Bar & Theme|Progress Bar & Theme]]
- [[_COMMUNITY_DateTime Input Component|DateTime Input Component]]
- [[_COMMUNITY_Transaction Card & Expense Types|Transaction Card & Expense Types]]
- [[_COMMUNITY_Core Shared Types|Core Shared Types]]
- [[_COMMUNITY_API & Store Types|API & Store Types]]
- [[_COMMUNITY_Mobile TypeScript Config|Mobile TypeScript Config]]
- [[_COMMUNITY_Web Favicon Cache|Web Favicon Cache]]
- [[_COMMUNITY_Metro Bundler Config|Metro Bundler Config]]
- [[_COMMUNITY_Expo Local Config (devices.json)|Expo Local Config (devices.json)]]
- [[_COMMUNITY_Expo Local Config (README)|Expo Local Config (README)]]
- [[_COMMUNITY_Expo Local Config (settings.json)|Expo Local Config (settings.json)]]

## God Nodes (most connected - your core abstractions)
1. `useC()` - 103 edges
2. `useT()` - 31 edges
3. `formatMoney()` - 30 edges
4. `useAuthStore` - 24 edges
5. `Palette` - 21 edges
6. `usePartnerStore` - 21 edges
7. `PressableScale()` - 17 edges
8. `prisma` - 17 edges
9. `Dance Planner App` - 16 edges
10. `compilerOptions` - 15 edges

## Surprising Connections (you probably didn't know these)
- `DancePlanner Favicon 48px (Mobile Web Cache)` --semantically_similar_to--> `DancePlanner Favicon 48px (Web Cache)`  [INFERRED] [semantically similar]
  apps/mobile/.expo/web/cache/production/images/favicon/favicon-a4e030697a7571b3e95d31860e4da55d2f98e5e861e2b55e414f45a8556828ba-contain-transparent/favicon-48.png → .expo/web/cache/production/images/favicon/favicon-a4e030697a7571b3e95d31860e4da55d2f98e5e861e2b55e414f45a8556828ba-contain-transparent/favicon-48.png
- `Server Upload PDF 1 (9894e8b3)` --conceptually_related_to--> `Dance Planner App`  [INFERRED]
  apps/server/uploads/9894e8b3-aeec-4ebe-80d0-b518340de361.pdf → apps/mobile/CLAUDE.md
- `Server Upload PDF 2 (c3ce06a2)` --conceptually_related_to--> `Dance Planner App`  [INFERRED]
  apps/server/uploads/c3ce06a2-5c20-4e3a-aede-b0085ee03967.pdf → apps/mobile/CLAUDE.md
- `AppLayout()` --calls--> `useC()`  [INFERRED]
  apps/mobile/app/(app)/_layout.tsx → apps/mobile/lib/useTheme.ts
- `ZoomBtn()` --calls--> `useC()`  [EXTRACTED]
  apps/mobile/app/(app)/(tabs)/calendar.tsx → apps/mobile/lib/useTheme.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Dance Planner Full-Stack Technology Stack** — claude_react_native, claude_expo_router, claude_nativewind, claude_zustand, claude_express_backend, claude_postgresql, claude_prisma_orm, claude_jwt_auth [EXTRACTED 1.00]

## Communities (46 total, 3 thin omitted)

### Community 0 - "Chat & Proposals UI"
Cohesion: 0.05
Nodes (44): ChatScreen(), NewProposalModal(), PROPOSAL_TYPES, AppLayout(), badge, ICONS, TabBar(), TabBarProps (+36 more)

### Community 1 - "WDSF Profile & Competition Analytics"
Cohesion: 0.05
Nodes (58): bestPlace(), BigStatCard(), buildCmpRounds(), CARD_RESET, CmpRound, COMP_MONTHS, CompareEventsView(), CompareTab() (+50 more)

### Community 2 - "About App Screen"
Cohesion: 0.06
Nodes (31): AboutAppScreen(), FEATURES, INFO_ROWS, WHY_ROWS, RootLayout(), OnboardingScreen(), Slide, SLIDES (+23 more)

### Community 3 - "Server Dependencies"
Cohesion: 0.04
Nodes (45): author, dependencies, bcryptjs, cheerio, cors, dotenv, express, express-rate-limit (+37 more)

### Community 4 - "WDSF Scraper Library"
Cohesion: 0.07
Nodes (39): buildCompUrls(), buildPhotoUrl(), ColInfo, CompetitionAnalytics, DancePrelimMarks, emptyScore3Components(), escapeRegex(), extractSlug() (+31 more)

### Community 5 - "Mobile Dependencies"
Cohesion: 0.05
Nodes (43): dependencies, expo, expo-constants, expo-device, expo-document-picker, expo-linear-gradient, expo-linking, @expo/metro-runtime (+35 more)

### Community 6 - "Side Drawer Navigation"
Cohesion: 0.07
Nodes (13): NAV_MAIN, NAV_SECONDARY, NavItem(), SideDrawer(), DrawerContext, DrawerCtx, DrawerProvider(), useDrawer() (+5 more)

### Community 7 - "Activity Log & Couple Members"
Cohesion: 0.13
Nodes (22): ActivityAction, ActivityInput, logActivity(), resourceNoun(), CoupleIds, coupleMemberIds(), findCoupleForUser(), findCoupleIdsForUser() (+14 more)

### Community 8 - "App Config (app.json)"
Cohesion: 0.08
Nodes (25): backgroundColor, backgroundImage, foregroundImage, monochromeImage, adaptiveIcon, package, predictiveBackGestureEnabled, projectId (+17 more)

### Community 9 - "Session Form & Display Utils"
Cohesion: 0.16
Nodes (16): Props, SessionFormModal(), CurrencyMeta, currencySymbol(), dayKey(), decimalFmt, getDisplayCurrency(), SESSION_META (+8 more)

### Community 10 - "Finance Dashboard Charts"
Cohesion: 0.16
Nodes (12): Legend(), MonthlyBarChart(), Props, monthKeyFromIso(), monthShort(), ForecastMonth, FinanceState, MonthAggregate (+4 more)

### Community 11 - "Email & Environment Config"
Cohesion: 0.15
Nodes (13): env, createTransport(), isSmtpConfigured(), sendPasswordResetEmail(), contactSchema, router, router, router (+5 more)

### Community 12 - "Auth & Validation Layer"
Cohesion: 0.13
Nodes (16): signToken(), createAttachmentSchema, createScheduleSchema, CURRENCY_CODES, EVENT_TYPES, EXPENSE_STATUSES, forgotPasswordSchema, loginSchema (+8 more)

### Community 13 - "Project Documentation"
Cohesion: 0.12
Nodes (18): Expo v56.0.0 Documentation, Competitive Dancesport Athletes, Dance Planner App, Expo Application Services (EAS), Expo Router (File-Based Routing), Express.js Backend, Finance Management Feature, JWT Authentication (+10 more)

### Community 14 - "i18n & Theme State"
Cohesion: 0.16
Nodes (14): CURRENCIES, CURRENCY_ORDER, useT(), Language, LanguageState, useLanguageStore, ThemeMode, ThemeState (+6 more)

### Community 15 - "Server TypeScript Config"
Cohesion: 0.11
Nodes (17): compilerOptions, declaration, esModuleInterop, forceConsistentCasingInFileNames, ignoreDeprecations, lib, module, moduleResolution (+9 more)

### Community 16 - "Expense Routes & DB Seed"
Cohesion: 0.12
Nodes (10): createExpenseSchema, EXPENSE_CATEGORIES, updateExpenseSchema, main(), Bucket, expenseSummary(), fmtMoney(), monthKey() (+2 more)

### Community 17 - "Finance Dashboard & Expenses Tab"
Cohesion: 0.19
Nodes (12): currentMonthKey(), monthLong(), shiftMonth(), useFinanceStore, ExpensesScreen(), BudgetModal(), Dashboard(), LANG_LOCALE (+4 more)

### Community 18 - "HTTP Utils & Budget Routes"
Cohesion: 0.21
Nodes (10): asyncHandler(), HttpError, param(), budgetUpsertSchema, linkPartnerSchema, router, buildCoupleResponse(), CoupleWithMembers (+2 more)

### Community 19 - "Calendar & Schedule Tab"
Cohesion: 0.17
Nodes (11): useScheduleStore, CalendarScreen(), DayCell(), dayHeading(), LANG_LOCALE, monthLabel(), StatChip(), todayKey() (+3 more)

### Community 20 - "Projects & Events"
Cohesion: 0.21
Nodes (12): EVENT_TYPE_META, formatDate(), ProjectDetail(), useProjectStore, daysUntil(), getProjectStatus(), NewProjectModal(), ProjectRow() (+4 more)

### Community 21 - "Category Donut & Checklist"
Cohesion: 0.18
Nodes (9): CategoryDonut(), DonutSlice, Props, EVENT_TYPE_ORDER, ChecklistItem, AttachmentRow(), BudgetStat(), ChecklistRow() (+1 more)

### Community 22 - "File Upload & Validation"
Cohesion: 0.18
Nodes (9): ALLOWED, storage, upload, UPLOADS_DIR, createChecklistItemSchema, createEventSchema, updateChecklistItemSchema, updateEventSchema (+1 more)

### Community 23 - "Expense Form Modal"
Cohesion: 0.24
Nodes (8): ExpenseFormModal(), todayISO(), CATEGORY_ORDER, Category, ExpenseStatus, ExpenseTemplate, TemplateState, useTemplateStore

### Community 24 - "Real-time Notifications & Schedule API"
Cohesion: 0.20
Nodes (5): notifyPartner(), notify(), ExpenseCategory, scheduleInclude, SessionType

### Community 25 - "Mobile App Branding Assets"
Cohesion: 0.18
Nodes (11): Android Adaptive Icon Design Template, Android Adaptive Icon Monochrome Variant, Android Adaptive Icon Background, Android Adaptive Icon Foreground (Blue Chevron Logo), Android Monochrome App Icon, DancePlanner Brand Identity, DancePlanner Logo Mark (Blue Chevron), Expo Splash Screen (+3 more)

### Community 26 - "Localization (i18n Strings)"
Cohesion: 0.38
Nodes (6): translations, de, en, Translations, ru, uk

### Community 27 - "JWT & WebSocket Auth"
Cohesion: 0.25
Nodes (6): TokenPayload, verifyToken(), attachWsServer(), connections, Request, requireAuth()

### Community 28 - "Progress Bar & Theme"
Cohesion: 0.22
Nodes (9): ProgressBar(), Props, styles, formatMoney(), C, SessionRow(), BalanceCard(), ForecastCard() (+1 more)

### Community 29 - "DateTime Input Component"
Cohesion: 0.39
Nodes (8): DateField(), hm(), pad(), parseHm(), parseYmd(), prettyDate(), TimeField(), ymd()

### Community 30 - "Transaction Card & Expense Types"
Cohesion: 0.28
Nodes (7): Props, Props, TransactionCard(), CATEGORY_META, formatShortDate(), Expense, MonthGroup

### Community 31 - "Core Shared Types"
Cohesion: 0.22
Nodes (8): Attachment, ChatMessageAuthor, ChatMessageKind, CouplePartner, ProposalDetails, ProposalSender, ProposalStatus, Summary

### Community 32 - "API & Store Types"
Cohesion: 0.48
Nodes (6): UploadFile, EventType, Project, CreateExpenseInput, CreateProjectInput, ProjectState

### Community 33 - "Mobile TypeScript Config"
Cohesion: 0.40
Nodes (4): compilerOptions, strict, types, extends

### Community 34 - "Web Favicon Cache"
Cohesion: 0.50
Nodes (4): Expo Web Production Favicon Cache, DancePlanner Favicon 48px (Web Cache), DancePlanner Favicon 48px (Mobile Web Cache), Mobile Expo Web Production Favicon Cache

### Community 35 - "Metro Bundler Config"
Cohesion: 0.50
Nodes (3): config, { getDefaultConfig }, { withNativeWind }

## Knowledge Gaps
- **256 isolated node(s):** `name`, `slug`, `scheme`, `version`, `orientation` (+251 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useC()` connect `WDSF Profile & Competition Analytics` to `Chat & Proposals UI`, `About App Screen`, `Side Drawer Navigation`, `Session Form & Display Utils`, `Finance Dashboard Charts`, `i18n & Theme State`, `Finance Dashboard & Expenses Tab`, `Calendar & Schedule Tab`, `Projects & Events`, `Category Donut & Checklist`, `Expense Form Modal`, `Progress Bar & Theme`, `DateTime Input Component`, `Transaction Card & Expense Types`?**
  _High betweenness centrality (0.084) - this node is a cross-community bridge._
- **Why does `Palette` connect `About App Screen` to `Chat & Proposals UI`, `WDSF Profile & Competition Analytics`, `Side Drawer Navigation`, `Session Form & Display Utils`, `Finance Dashboard Charts`, `i18n & Theme State`, `Finance Dashboard & Expenses Tab`, `Calendar & Schedule Tab`, `Projects & Events`, `Category Donut & Checklist`, `Expense Form Modal`, `Transaction Card & Expense Types`?**
  _High betweenness centrality (0.008) - this node is a cross-community bridge._
- **Why does `usePartnerStore` connect `Chat & Proposals UI` to `WDSF Profile & Competition Analytics`, `Side Drawer Navigation`, `Finance Dashboard Charts`, `i18n & Theme State`, `Finance Dashboard & Expenses Tab`, `Calendar & Schedule Tab`, `Projects & Events`, `Category Donut & Checklist`?**
  _High betweenness centrality (0.005) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `useC()` (e.g. with `AppLayout()` and `RootLayout()`) actually correct?**
  _`useC()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `name`, `slug`, `scheme` to the rest of the system?**
  _256 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Chat & Proposals UI` be split into smaller, more focused modules?**
  _Cohesion score 0.050921861281826165 - nodes in this community are weakly interconnected._
- **Should `WDSF Profile & Competition Analytics` be split into smaller, more focused modules?**
  _Cohesion score 0.05179982440737489 - nodes in this community are weakly interconnected._