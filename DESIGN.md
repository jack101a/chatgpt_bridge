---
version: 1.0.0
name: Bridge Studio Design System
description: Clean, minimalist, mobile-first design system for self-hosted ChatGPT Bridge.
colors:
  bg: "#ffffff"
  bg-subtle: "#f7f7f8"
  bg-dark: "#0a0a0c"
  surface: "#ffffff"
  surface-dark: "#141416"
  border: "#e5e5e5"
  border-dark: "#27272a"
  text-primary: "#0d0d0d"
  text-secondary: "#6e6e80"
  text-dark-primary: "#f4f4f5"
  text-dark-secondary: "#a1a1aa"
  accent: "#10a37f"
  accent-hover: "#0d926e"
  accent-subtle: "rgba(16, 163, 127, 0.12)"
  cooldown-amber: "#f59e0b"
  danger-red: "#ef4444"
typography:
  heading:
    fontFamily: Geist, -apple-system, sans-serif
    fontSize: 20px
    fontWeight: 600
    lineHeight: 1.2
  body:
    fontFamily: Geist, -apple-system, sans-serif
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
  meta:
    fontFamily: Geist Mono, monospace
    fontSize: 11px
    fontWeight: 500
rounded:
  sm: 6px
  md: 12px
  lg: 18px
  pill: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
---

# Bridge Studio Design System

## Overview
Bridge is a companion command deck and mobile-first studio for automating ChatGPT DALL-E image generation with multi-account rotation and continuity. The design balances OpenAI's clean, minimalist white canvas with a high-end mobile experience and a pure, zero-chrome image viewing mode.

## Colors
- **Light Theme (Default)**: Clean white canvas (`#ffffff`) with subtle contrast backgrounds (`#f7f7f8`).
- **Dark & Viewer Theme**: Deep pitch-black OLED background (`#000000` / `#0a0a0c`) for zero-distraction viewing.
- **Brand Accent**: Electric emerald (`#10a37f`), consistent with ChatGPT while maintaining distinct elegance.

## Typography
- **Primary**: `Geist` — clean, crisp sans-serif with excellent legibility on mobile screens.
- **Technical & Stats**: `Geist Mono` — used for latency, file sizes, account tags, and conversation IDs.

## Layout & Navigation
- **Mobile (< 1024px)**: 3-tab bottom navigation (`Chat`, `Gallery`, `Settings`) with thumb-friendly touch targets. Safe-area padding at bottom.
- **Desktop (>= 1024px)**: Fixed 260px left sidebar with thread grouping and account telemetry.

## Dual-Mode Image Viewer
- **Inspect Mode**: Shows the image centered on dark canvas with full metadata (prompt, refinement layer, account, latency, size) and a floating thumb pill toolbar.
- **Pure Focus Mode**: Full-screen edge-to-edge artwork with **ZERO UI / ZERO Chrome in between**. Single tap toggles between Inspect and Pure Focus mode. Free pinch/wheel zoom and smooth pan.

## Do's and Don'ts
- **DO** keep image previews completely unobstructed by gradients or dark veils.
- **DO** maintain 44x44px minimum touch targets on mobile.
- **DON'T** auto-zoom on single tap/click; preserve user intent.
- **DON'T** use purple gradients as default UI styling.
