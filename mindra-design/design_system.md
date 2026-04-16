# Mindra Website: Design System Specification

Since we are waiting for the visual assets, this document defines the **strict visual rules** for the website. This ensures that when we *do* start coding (or generating more images), we have a single source of truth for the aesthetics.

## 1. Base Theme (The "Hub")
**Vibe**: Minimalist, Luxury, Cinematic.

### Colors
- **Primary**: `Black (#000000)`
- **Secondary**: `White (#FFFFFF)`
- **Accent**: `Dark Grey (#1A1A1A)` - used for subtle borders or hover states.
- **Text**: `White` on Black background.

### Typography
- **Headings**: `Syne` or `Inter` (Extra Bold). Tight tracking (-0.02em).
- **Body**: `Inter` (Light/Regular). Wide tracking (+0.01em) for readability.

### Effects
- **Glassmorphism**: `backdrop-filter: blur(12px); background: rgba(255, 255, 255, 0.1);`
- **Texture**: Subtle CSS noise overlay (opacity 0.05) to prevent "flatness".
- **Animation**: "Magnetic" buttons that stick to the cursor slightly.

---

## 2. Party Theme
**Vibe**: Cyberpunk, Neon, High-Energy.

### Colors
- **Background**: `Deep Black (#050505)`
- **Primary Accent**: `Electric Blue (#00F0FF)`
- **Secondary Accent**: `Hot Pink (#FF0099)`
- **Tertiary**: `Acid Green (#CCFF00)` - used sparingly for "Book Now" buttons.

### Typography
- **Headings**: `Clash Display` (Variable). High contrast.
- **Body**: `Space Mono` or `JetBrains Mono`. Tech/Code aesthetic.

### Effects
- **Glow**: `box-shadow: 0 0 20px rgba(0, 240, 255, 0.5);`
- **Glitch**: CSS keyframe animations on hover (RGB shift).
- **Motion**: Marquee text (scrolling text) for "HYPE" sections.

---

## 3. Business Theme
**Vibe**: Corporate, Trustworthy, Fintech.

### Colors
- **Primary**: `Navy Blue (#0A192F)`
- **Secondary**: `Slate Grey (#8892B0)`
- **Background**: `Off-White (#F8F9FA)` or `Light Grey (#E2E8F0)` for sections.
- **Success**: `Teal (#14B8A6)` - for "Results" metrics.

### Typography
- **Headings**: `Helvetica Now Display` or `Roboto` (Bold).
- **Body**: `Inter` or `Roboto` (Regular). High legibility.

### Effects
- **Shadows**: Soft, diffuse shadows `box-shadow: 4px 4px 10px rgba(0, 0, 0, 0.05);`
- **Borders**: Thin, subtle borders `1px solid #E2E8F0`.
- **Gradients**: Very subtle top-to-bottom fades for hero sections.

---

## 4. Wedding Theme
**Vibe**: Editorial, Romantic, Soft.

### Colors
- **Background**: `Cream / Eggshell (#FDFBF7)`
- **Primary Text**: `Charcoal (#2D2D2D)` - never pure black.
- **Accent**: `Soft Gold (#D4AF37)` - used for lines and italics.
- **Secondary**: `Sage Green (#8FBC8F)` or `Dusty Rose (#C08081)`.

### Typography
- **Headings**: `Playfair Display` (Italic). Elegant and high-contrast.
- **Body**: `Lato` or `Montserrat` (Light).

### Effects
- **Images**: No borders. Soft fade-in on scroll.
- **Overlays**: Warm gradient overlays `linear-gradient(to bottom, transparent, rgba(253, 251, 247, 1))`.
- **Scroll**: Parallax effects for large background images.
