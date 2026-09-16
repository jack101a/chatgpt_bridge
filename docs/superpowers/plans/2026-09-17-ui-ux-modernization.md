# UI/UX Modernization & Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign and modernize the entire ChatGPT Bridge command deck into an ultra-sleek, responsive, high-performance web & mobile app experience referencing the design patterns of `sv-animations`, `sv-table`, `sv-blocks`, `sv-efferd`, `sv-matrix`, `sv-particles`, and `sv-agentation`.

**Architecture:** 
- Modular React 19 + TypeScript + Tailwind CSS architecture with strict separation of concerns (UI presentational components, custom hooks, API service layer, typed domain interfaces).
- Anti-slop design system featuring high-tech dot-matrix canvas/SVG loaders, subtle radial gradient mesh backgrounds, unified theme variables, and tactile micro-interactions.
- Integrated keyboard-first Command Palette (`Cmd+K`) and dev/agent inspection actions inspired by `sv-agentation`.
- Rich data-table and faceted gallery controls inspired by `sv-table` (view density, filters, batch operations).

**Tech Stack:** React 19, TypeScript 5.7, Vite 6, Tailwind CSS 3.4, Lucide React icons, Native SVG & Canvas micro-animations.

---

## Global Constraints

- Preserve all existing API endpoints, WebSocket message contracts, and character lock mechanisms.
- All code must build cleanly with zero TypeScript errors (`tsc -b && vite build`).
- Dark mode must remain first-class with smooth transitions and consistent contrast (WCAG AA compliant).
- All touch targets on mobile must be at least 44x44px with proper safe-area padding (`env(safe-area-inset-bottom)`).

---

## Tasks

### Task 1: Design Tokens, Grid Mesh Background & High-Tech Matrix Loaders
Reference: `sv-matrix.vercel.app`, `sv-particles.vercel.app`, `sv-animations.vercel.app`

**Files:**
- Create: `frontend/src/components/common/DotMatrixLoader.tsx`
- Create: `frontend/src/components/common/GridPatternBackground.tsx`
- Modify: `frontend/src/index.css`
- Modify: `frontend/tailwind.config.js`

**Interfaces:**
- `DotMatrixLoader`: Props `{ size?: 'sm' | 'md' | 'lg'; speed?: number; variant?: 'hex' | 'square' | 'prism'; className?: string; label?: string }`
- `GridPatternBackground`: Props `{ className?: string; strokeDasharray?: string }`

- [x] Step 1: Update Tailwind config & CSS with refined dark/light tokens, grid patterns, and animation utilities.
- [x] Step 2: Implement `DotMatrixLoader.tsx` with animated canvas/SVG dot-matrix effects (`hex`, `square`, and `prism` loader patterns).
- [x] Step 3: Implement `GridPatternBackground.tsx` rendering subtle radial-masked grid lines.
- [x] Step 4: Verify build with `npm --prefix frontend run build`.
- [x] Step 5: Commit changes.

---

### Task 2: Universal Command Palette & Keyboard Shortcuts System
Reference: `sv-agentation.com`

**Files:**
- Create: `frontend/src/components/common/CommandPaletteModal.tsx`
- Create: `frontend/src/components/common/KeyboardShortcutsModal.tsx`
- Create: `frontend/src/hooks/useCommandPalette.ts`
- Modify: `frontend/src/App.tsx`

**Interfaces:**
- `CommandPaletteModal`: Props `{ isOpen: boolean; onClose: () => void; onNavigateTab: (tab: string) => void; onTriggerAction: (actionId: string) => void; characters: CharacterCard[]; activeCharacter: CharacterCard | null; onSelectCharacter: (char: CharacterCard) => void }`
- `KeyboardShortcutsModal`: Props `{ isOpen: boolean; onClose: () => void }`

- [ ] Step 1: Implement `useCommandPalette.ts` managing keyboard shortcuts (`Cmd+K`, `Ctrl+K`, `?`, `Esc`, arrow navigation).
- [ ] Step 2: Implement `CommandPaletteModal.tsx` with fuzzy search, categorized actions (Tabs, Characters, Quick Tools, Accounts), and tactile selection.
- [ ] Step 3: Implement `KeyboardShortcutsModal.tsx` displaying cheatsheet for navigation, generating, and inspection.
- [ ] Step 4: Wire Command Palette into `App.tsx` and test modal toggles.
- [ ] Step 5: Commit changes.

---

### Task 3: Modern App Header & Navigation Overhaul
Reference: `sv-blocks.vercel.app`, `sv-efferd.pages.dev`

**Files:**
- Create: `frontend/src/components/navigation/AppHeader.tsx`
- Modify: `frontend/src/components/navigation/DesktopSidebar.tsx`
- Modify: `frontend/src/components/navigation/MobileBottomNav.tsx`
- Modify: `frontend/src/App.tsx`

**Interfaces:**
- `AppHeader`: Props `{ currentTab: string; activeCharacter: CharacterCard | null; onOpenCharacters: () => void; onOpenAccounts: () => void; onOpenCommandPalette: () => void; onToggleTheme: () => void; isDarkMode: boolean; isConnected: boolean; onOpenDirector?: () => void }`

- [ ] Step 1: Implement `AppHeader.tsx` with backdrop-blur glassmorphism, active character lock badge, command palette launcher (`Search / ⌘K`), account indicator, and animated theme toggle.
- [ ] Step 2: Modernize `DesktopSidebar.tsx` with cleaner icon active-states, badge counters, and collapsing tooltips.
- [ ] Step 3: Modernize `MobileBottomNav.tsx` with haptic-feedback styling, indicator pills, and safe-area padding.
- [ ] Step 4: Integrate `AppHeader` into `App.tsx` across all screen sizes.
- [ ] Step 5: Test responsive layout and commit changes.

---

### Task 4: Advanced Gallery UX with Faceted Filtering & Density Modes
Reference: `sv-table.vercel.app`, `sv-efferd.pages.dev`

**Files:**
- Create: `frontend/src/components/gallery/GalleryToolbar.tsx`
- Create: `frontend/src/components/gallery/BatchActionBar.tsx`
- Modify: `frontend/src/components/gallery/GalleryView.tsx`

**Interfaces:**
- `GalleryToolbar`: Props `{ search: string; onSearchChange: (s: string) => void; density: 'grid' | 'masonry' | 'compact'; onDensityChange: (d: 'grid' | 'masonry' | 'compact') => void; filter: string; onFilterChange: (f: string) => void; sortOrder: 'newest' | 'oldest'; onSortOrderChange: (s: 'newest' | 'oldest') => void; isBatchMode: boolean; onToggleBatchMode: () => void; selectedCount: number }`
- `BatchActionBar`: Props `{ selectedCount: number; onFavoriteAll: () => void; onDeleteAll: () => void; onDownloadAll: () => void; onClearSelection: () => void }`

- [ ] Step 1: Implement `GalleryToolbar.tsx` with keyword search, aspect ratio filters, density switcher (Grid/Masonry/Compact), and sort controls.
- [ ] Step 2: Implement `BatchActionBar.tsx` for multi-selection workflows (bulk download, bulk favorite, bulk delete).
- [ ] Step 3: Upgrade `GalleryView.tsx` supporting the 3 density modes and batch multi-selection. Replace simple spinners with `DotMatrixLoader`.
- [ ] Step 4: Test filtering, selection, and gallery rendering.
- [ ] Step 5: Commit changes.

---

### Task 5: Chat & Director Experience Polishing with Matrix Status
Reference: `sv-animations.vercel.app`, `sv-matrix.vercel.app`, `sv-agentation.com`

**Files:**
- Modify: `frontend/src/components/chat/MessageBubble.tsx`
- Modify: `frontend/src/components/chat/Composer.tsx`
- Modify: `frontend/src/components/director/DirectorModal.tsx`
- Modify: `frontend/src/components/director/StoryboardTray.tsx`

**Interfaces:**
- Incorporate `DotMatrixLoader` into live generation states in `MessageBubble` and `DirectorModal`.
- Add quick-copy prompt badge with animated copied feedback.
- Enhance Storyboard shot preview cards with camera POV badges and duration telemetry.

- [ ] Step 1: Upgrade `MessageBubble.tsx` to render `DotMatrixLoader` when generating images, and add clean prompt copy interactions.
- [ ] Step 2: Polish `Composer.tsx` with character lock status badge, reference thumbnail chips, and keyboard hints (`↵ to send`, `⇧↵ for newline`).
- [ ] Step 3: Upgrade `DirectorModal.tsx` and `StoryboardTray.tsx` with Bento-grid shot cards and real-time step progress animations.
- [ ] Step 4: Test Chat and Director interactions.
- [ ] Step 5: Commit changes.

---

### Task 6: End-to-End Build, Full Audit & Final Polish
- [ ] Step 1: Run `npm --prefix frontend run build` to verify zero TypeScript/bundle errors.
- [ ] Step 2: Test light mode and dark mode across desktop and mobile screen viewports.
- [ ] Step 3: Verify backend daemon compatibility on port `8466`.
- [ ] Step 4: Review WCAG contrast and button clarity.
- [ ] Step 5: Final commit and push to git repository.
