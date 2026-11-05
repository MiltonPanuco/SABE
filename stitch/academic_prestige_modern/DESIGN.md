---
name: Academic Prestige Modern
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#42474d'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#73777e'
  outline-variant: '#c3c7ce'
  surface-tint: '#406182'
  primary: '#001629'
  on-primary: '#ffffff'
  primary-container: '#002b49'
  on-primary-container: '#7293b6'
  inverse-primary: '#a8caef'
  secondary: '#855300'
  on-secondary: '#ffffff'
  secondary-container: '#fea619'
  on-secondary-container: '#684000'
  tertiary: '#00190e'
  on-tertiary: '#ffffff'
  tertiary-container: '#00301e'
  on-tertiary-container: '#00a472'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#cfe5ff'
  primary-fixed-dim: '#a8caef'
  on-primary-fixed: '#001d34'
  on-primary-fixed-variant: '#274969'
  secondary-fixed: '#ffddb8'
  secondary-fixed-dim: '#ffb95f'
  on-secondary-fixed: '#2a1700'
  on-secondary-fixed-variant: '#653e00'
  tertiary-fixed: '#6ffbbe'
  tertiary-fixed-dim: '#4edea3'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005236'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  display-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 2.25rem
    fontWeight: '700'
    lineHeight: 2.75rem
    letterSpacing: -0.025em
  display-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 1.75rem
    fontWeight: '700'
    lineHeight: 2.25rem
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 1.5rem
    fontWeight: '600'
    lineHeight: 2rem
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 1.25rem
    fontWeight: '600'
    lineHeight: 1.75rem
    letterSpacing: -0.015em
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 1.125rem
    fontWeight: '600'
    lineHeight: 1.5rem
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 1rem
    fontWeight: '400'
    lineHeight: 1.625rem
  body-md:
    fontFamily: Inter
    fontSize: 0.875rem
    fontWeight: '400'
    lineHeight: 1.375rem
  body-sm:
    fontFamily: Inter
    fontSize: 0.75rem
    fontWeight: '400'
    lineHeight: 1.125rem
  label-lg:
    fontFamily: Inter
    fontSize: 0.875rem
    fontWeight: '600'
    lineHeight: 1.25rem
    letterSpacing: 0.01em
  label-md:
    fontFamily: Inter
    fontSize: 0.75rem
    fontWeight: '600'
    lineHeight: 1rem
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Inter
    fontSize: 0.6875rem
    fontWeight: '600'
    lineHeight: 0.875rem
    letterSpacing: 0.04em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1.5rem
  gutter-sm: 1rem
  margin: 2rem
  margin-sm: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

This design system serves undergraduate and graduate students navigating critical academic journeys: enrollment windows, subject additions and drops, schedule validation, and academic history tracking. 

The aesthetic is **Corporate / Modern with Academic Gravitas**. It balances the institutional trust of an academic faculty with the speed, clarity, and friendliness needed by students under tight deadlines. It avoids bureaucratic visual fatigue by using generous spacing, precise contrast ratios, crisp typography, and high-visibility status cues for time-sensitive registration procedures.

The emotional signature is **confident, dependable, and reassuringly clear**.

## Colors

The palette is anchored by the university's institutional identity and supplemented by functional operational indicators:

- **Primary (`#002B49`)**: Deep Academic Navy. Used for institutional navigation, key headers, active state highlights, primary interactive anchors, and structural headers.
- **Secondary (`#F59E0B`)**: Amber Gold. Represents academic prestige, priority warnings, enrollment appointments, credits earned, and pending administrative review steps.
- **Tertiary (`#10B981`)**: Emerald Green. Functional indicator dedicated to successful actions, added subjects ("Altas"), approved pre-requisites, and validated credit counts.
- **Error / Conflict (`#DC2626` / `#991B1B`)**: Crimson. Reserved strictly for subject drops ("Bajas"), schedule collisions, blocked requisites, and enrollment alerts.
- **Surface & Backgrounds**: Layered off-white and cool slates (`#F8FAFC`, `#F1F5F9`) paired with pure white (`#FFFFFF`) cards to ensure high legibility and reduce eye strain during prolonged registration sessions.
- **Neutral / Text**: Dark slate (`#0F172A`) for core typography and slate (`#64748B`) for secondary metadata and auxiliary labels.

## Typography

The typographic hierarchy pairs **Plus Jakarta Sans** for structural headers with **Inter** for data-dense listings, tables, and form inputs.

- **Plus Jakarta Sans**: Delivers contemporary, welcoming geometry with high readability at medium-to-large sizes. Used in screen headings, course names, and dashboard metrics.
- **Inter**: Ensures peak legibility in multi-column schedules, course credit badges, prerequisites, and grade records. High x-height prevents reading errors when scanning section codes and room assignments.
- Numerical data in timetables and student ID blocks use tabular lining figures (`font-variant-numeric: tabular-nums`) for strict column alignment.

## Layout & Spacing

The layout is built upon an 8pt spatial grid configured within a 12-column responsive fluid container capped at a maximum width of `1440px`.

- **Mobile (<768px)**: 4-column layout with `1rem` (16px) margins and gutters. Single-column stacked cards for courses; schedule views transition from 2D grid to chronological list format.
- **Tablet (768px - 1023px)**: 8-column layout with `1.5rem` (24px) gutters. Side drawer for student summary with stacked main content.
- **Desktop (>=1024px)**: 12-column grid with `1.5rem` gutters and `2rem` outer canvas padding. Facilitates split views: 8 columns for course selection/catalog and 4 columns for real-time timetable validation and pending changes.

## Elevation & Depth

Visual hierarchy uses **tonal layering and low-contrast borders** accompanied by soft, ambient navy-tinted drop shadows:

- **Level 0 (Flat / Canvas)**: Background rendered in `slate-50` (`#F8FAFC`).
- **Level 1 (Cards & Panels)**: Pure `#FFFFFF` surface bounded by a subtle `1px` border of `slate-200` (`#E2E8F0`). Shadow: `0 1px 3px 0 rgba(0, 43, 73, 0.04), 0 1px 2px -1px rgba(0, 43, 73, 0.04)`.
- **Level 2 (Interactive Cards & Filters)**: Elevated on hover or active selection. Shadow: `0 4px 6px -1px rgba(0, 43, 73, 0.07), 0 2px 4px -2px rgba(0, 43, 73, 0.07)`.
- **Level 3 (Sticky Schedules & Floating Action Drawers)**: High priority summaries during registration. Shadow: `0 10px 15px -3px rgba(0, 43, 73, 0.08), 0 4px 6px -4px rgba(0, 43, 73, 0.04)`.
- **Level 4 (Conflict Dialogs & Modals)**: Critical decision alerts. Shadow: `0 20px 25px -5px rgba(0, 43, 73, 0.12), 0 8px 10px -6px rgba(0, 43, 73, 0.08)`.

## Shapes

The geometric personality is **Balanced & Accessible (Level 2)**. 

- Interactive controls (buttons, inputs, select triggers) feature a `0.5rem` (8px) radius, providing an approachable aesthetic that avoids both severe brutalism and overly playful pill shapes.
- Content containers, schedule cells, and cards use `0.75rem` to `1rem` (12px–16px) corner rounding to frame complex tabular data comfortably.
- Small indicator badges and status pills leverage full pill rounding (`rounded-full`) to contrast sharply against structural rectangular containers.

## Components

### Buttons
- **Primary**: Solid Navy (`#002B49`) background with white text, font weight 600, transitions to `#001A2C` on hover with subtle transform.
- **Altas (Action - Add Subject)**: Emerald Green (`#059669`) background, white text, clear `+` icon prefix. Hover: `#047857`.
- **Bajas (Action - Drop Subject)**: Crimson Red (`#DC2626`) light outline or secondary surface (`#FEF2F2`), red text, hover states transition to solid `#DC2626` with white text.
- **Secondary / Tertiary**: White background, `slate-300` border, `slate-700` text, navy hover state.

### Chips & Badges
- **Status "Alta Confirmada"**: `#ECFDF5` background, `#047857` text, emerald checkmark icon.
- **Status "Baja Solicitada"**: `#FEF2F2` background, `#B91C1C` text, trash or minus icon.
- **Status "En Conflicto"**: `#FFFBEB` background with `#B45309` amber text or high-contrast red warning when overlapping hours occur.
- **Credit Badges**: Navy tint (`#F0F4F8`) with `#002B49` text to clearly communicate academic value (e.g., "8 Créditos").

### Inputs & Selectors
- Background `#FFFFFF`, border `1px solid #CBD5E1`.
- Focus ring: `2px` ring in institutional navy (`#002B49`) with `2px` offset.
- Floating helper text for schedule prerequisite validation.

### Cards (Course Cards & Timetable Blocks)
- Course cards include department code header, professor info, available quota progress bar, and explicit schedule timing tags.
- Interactive hover shows immediate clash warnings if conflicting with already selected subjects.

### Weekly Timetable Grid
- 5 or 6-column matrix (Monday to Saturday) segmented into hourly blocks.
- Courses render as compact colored blocks: Emerald (`#ECFDF5` border `#10B981`) for confirmed enrollments, Striped Amber for pending review, and Pulsing Crimson for detected schedule collisions.