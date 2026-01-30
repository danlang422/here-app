# Here App - Design System

**Version:** 1.0  
**Last Updated:** January 29, 2026  
**Style Direction:** Clean Bright  
**Status:** ⚠️ PARTIALLY IMPLEMENTED - See Implementation Notes Below

This document defines the visual language, interaction patterns, and implementation guidelines for Here app. It captures design decisions made during the style exploration phase and serves as the source of truth for implementation.

---

## ⚠️ Implementation Status (Updated January 30, 2026)

This design system represents the **original vision** for the student agenda. During implementation, several aspects evolved or remain incomplete:

### ✅ **Fully Implemented:**
- Color palette (base colors, section type colors)
- Emoji buttons (👋 wave, ✌️ peace animations)
- Card gradient backgrounds and shadows
- Collapsible Plans/Progress section with tabs
- Section type badges
- Spacing system and border radius values

### 🔄 **Implemented Differently:**
- **Button styling**: Emojis now have NO background (not gradient buttons). Pressed state uses grayscale + position shift instead of depressed button appearance.
- **Button positioning**: Buttons are OUTSIDE cards (to the right on desktop, below on mobile), not inside the "action area" as originally designed.
- **Presence wave text**: Uses CSS tooltip on hover instead of animated fade in/out text.
- **"Here" text color rotation**: Only implemented in header, not throughout agenda cards.

### ❌ **Not Yet Implemented:**
- "Here" text rainbow shimmer hover effect (CSS defined but `.here` class not applied to agenda text)
- Color rotation for "here" instances in agenda cards
- Background orbs on cards (CSS defined but connection logic unclear)
- Some animation timing details may differ from specs

### 📝 **Added During Implementation:**
- Time-based button restrictions (15min before/after windows)
- Button state persistence across date navigation
- Disabled state feedback messages
- CSS tooltip system for presence waves

**Recommendation:** Keep this document as a reference for the original vision and core principles. After final visual polish is complete, either update with "as-built" specifications or create a new "DESIGN_SYSTEM_V2.md" reflecting the actual implementation.

---

## Philosophy

Here app welcomes users with warmth and clarity. The design is:
- **Calm but present** - Not hyperactive, not sterile
- **Warm but not loud** - Inviting without overwhelming
- **Clean but not bland** - Simple with moments of delight
- **Human-centered** - Feels personal, not corporate

The 👋 emoji is THE central metaphor - it appears throughout the app as the primary interaction element, reinforcing the "you are HERE" concept.

---

## Color Palette

### Base Colors

**Backgrounds:**
- Primary background: `#FFFEF9` (off-white with warm undertone)
- Card background: `linear-gradient(135deg, #FFFEF9 0%, #FFF8F0 100%)` (cream gradient)
- White: `#FFFFFF` (for contrast when needed)

**Text:**
- Primary text: `#1F2937` (dark gray, not pure black)
- Secondary text: `#6B7280` (medium gray)
- Muted text: `#9CA3AF` (light gray, for less important info)

### Accent Colors (The Palette)

These 4 colors are used throughout the app for section types, labels, and the special "here" text treatment:

1. **Orange:** `#FF9500` - Primary accent, warm and energetic
2. **Purple:** `#7C3AED` - Cool contrast, creative
3. **Pink:** `#DB2777` - Playful, friendly
4. **Yellow:** `#F59E0B` - Bright, optimistic

**Usage:**
- Section type badges use these colors at 12% opacity backgrounds with full-color text
- The word "here" rotates through these colors (see Typography section)
- Button accents and highlights use these colors
- Background orbs use these colors at very low opacity (8%)

### Section Type Colors

Applied to section badges and related UI elements:

- **Remote:** Purple (`#7C3AED`)
  - Background: `rgba(124, 58, 237, 0.12)`
  - Text: `#7C3AED`

- **Internship:** Pink (`#DB2777`)
  - Background: `rgba(219, 39, 119, 0.12)`
  - Text: `#DB2777`

- **Class:** Yellow/Amber (`#F59E0B`)
  - Background: `rgba(245, 158, 11, 0.12)`
  - Text: `#D97706` (slightly darker for readability)

### Role Colors (Existing Pattern - Keep for Now)

- **Admin:** `#6366F1` (Indigo)
- **Teacher:** `#10B981` (Green) 
- **Student:** `#3B82F6` (Blue)

*Note: These may be revisited during navigation redesign but should remain for role-switching UI.*

---

## Typography

### Font Stack

```css
font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
```

Standard system fonts for maximum readability and performance.

### Font Sizes & Weights

**Headings:**
- H1: `32px`, weight `700` (page titles)
- H2: `24px`, weight `700` (section headings)
- H3: `18px`, weight `700` (card titles, section names)

**Body:**
- Default: `15px`, weight `400-500`
- Small: `13-14px`, weight `400-500`
- Tiny: `11-12px`, weight `600` (labels, badges)

### The Special "Here" Treatment

The word "here" receives special styling throughout the app to reinforce the brand:

**Color Rotation Pattern:**
- On page load, randomly select starting color from the 4-color palette
- Each instance of "here" uses the next color in rotation
- Example: Purple → Pink → Orange → Yellow → Purple → ...
- Randomized start means no two days look identical

**Base Styling:**
```css
.here {
  font-weight: 700;
  /* Color assigned dynamically from rotation */
}
```

**Hover Effect (Rainbow Shimmer):**
```css
.here:hover {
  background: linear-gradient(135deg, #FF9500 0%, #7C3AED 33%, #DB2777 66%, #F59E0B 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-size: 200% 200%;
  animation: rainbowShimmer 1s ease-in-out;
}

@keyframes rainbowShimmer {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
```

**Implementation Note:** 
- Apply `.here` class to every instance of the word "here" in the UI
- JavaScript assigns colors on mount based on rotation index
- Hover effect works universally across all instances

---

## Spacing System

Use consistent spacing values for predictable layouts:

- `4px` - Tiny gaps (between closely related elements)
- `8px` - Small gaps (icon-to-text, tight groupings)
- `12px` - Medium gaps (button padding, element spacing)
- `16px` - Default gaps (most common spacing)
- `20px` - Large gaps (between card sections)
- `24px` - XL gaps (card padding, section spacing)
- `30px` - XXL gaps (between major sections)

**Border Radius:**
- Buttons: `12-16px` (friendly but not pill-shaped)
- Cards: `20px` (soft, approachable)
- Small elements (badges, pills): `8px`
- Large containers: `24px`

---

## Components

### Agenda Cards

**Structure:**
```
┌─────────────────────────────────────┐
│ [Section Name]          [Type Badge]│ ← Header
│ [Time]                              │
│                                     │
│ [Text] [👋] [✌️] [Text]            │ ← Action area
│                                     │
│ ▼ Plans & progress                  │ ← Collapsible
│   ┌─────────────────────────────┐  │
│   │ Plans | Progress            │  │
│   │ [Content]                   │  │
│   └─────────────────────────────┘  │
└─────────────────────────────────────┘
```

**Base Styling:**
```css
.agenda-card {
  background: linear-gradient(135deg, #FFFEF9 0%, #FFF8F0 100%);
  border-radius: 20px;
  padding: 24px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);
  position: relative;
  overflow: hidden;
  transition: all 0.3s ease;
}

.agenda-card:hover {
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
}
```

**Background Orb (Optional Accent):**
```css
.agenda-card::before {
  content: '';
  position: absolute;
  top: -30px;
  right: -30px;
  width: 120px;
  height: 120px;
  background: radial-gradient(circle, rgba(255, 149, 0, 0.08) 0%, transparent 70%);
  border-radius: 50%;
  pointer-events: none;
}
```

*Note: Orb color could rotate through accent palette or match section type. To be decided during implementation.*

### Emoji Buttons (👋 and ✌️)

The core interactive element of the app. Used for check-ins, presence waves, and check-outs.

**Base Button Styling:**
```css
.emoji-btn {
  width: 64px;
  height: 64px;
  background: linear-gradient(135deg, #FFF5E8 0%, #FFE8CC 100%);
  border: 2px solid rgba(255, 149, 0, 0.2);
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 12px rgba(255, 149, 0, 0.15);
}

.emoji-btn .emoji {
  font-size: 32px;
  transition: transform 0.2s ease;
  display: inline-block;
}
```

**Interaction States:**

*Before Click (Hover Only):*
```css
.emoji-btn:hover:not(.pressed) {
  transform: translateY(-3px);
  box-shadow: 0 6px 20px rgba(255, 149, 0, 0.25);
}

.emoji-btn:hover:not(.pressed) .emoji {
  transform: translateY(-2px) scale(1.1);
}
```
Creates the "pop" effect - button and emoji lift separately.

*Pressed State:*
```css
.emoji-btn.pressed {
  background: linear-gradient(135deg, #E8E0D5 0%, #D5CCBB 100%);
  box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.1);
  transform: translateY(2px);
  border-color: rgba(255, 149, 0, 0.15);
}
```
Button appears depressed into the surface.

**Wave Animation (👋):**

Plays on click and on hover of pressed button. Executes 2 times then stops.

```css
@keyframes wave {
  0%, 100% { transform: rotate(0deg); }
  25% { transform: rotate(20deg); }
  50% { transform: rotate(0deg); }
  75% { transform: rotate(-20deg); }
}

.emoji-btn .emoji.waving {
  animation: wave 0.6s ease-in-out;
  animation-iteration-count: 2;
}
```

**Peace Sign Rotation (✌️):**

Plays on successful check-out submission. Full 360° rotation with slight scale.

```css
@keyframes peaceRotate {
  0% { transform: rotate(0deg) scale(1); }
  50% { transform: rotate(180deg) scale(1.1); }
  100% { transform: rotate(360deg) scale(1); }
}

.emoji-btn .emoji.peace-out {
  animation: peaceRotate 0.5s ease-in-out;
}
```

### Button Text Labels

Text that appears adjacent to emoji buttons, guiding user actions.

**Styling:**
```css
.btn-text {
  font-size: 15px;
  font-weight: 600;
  color: #1F2937;
}

.btn-text.muted {
  opacity: 0.5;
}
```

**Animation (Presence Waves Only):**

For optional presence waves, text fades in → pauses 3 seconds → fades out.

```css
@keyframes fadeInText {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes fadeOutText {
  from {
    opacity: 1;
    transform: translateY(0);
  }
  to {
    opacity: 0;
    transform: translateY(-10px);
  }
}

.btn-text.show {
  animation: fadeInText 0.6s ease-out forwards;
}

.btn-text.hide {
  animation: fadeOutText 0.6s ease-out forwards;
}
```

**Implementation Note:**
```javascript
// On page load for presence waves:
setTimeout(() => {
  textElement.classList.remove('show');
  textElement.classList.add('hide');
}, 3000); // Show for 3 seconds then fade
```

For required check-ins, text does NOT fade - it remains visible with `opacity: 1`.

### Collapsible Plans & Progress Section

Appears after check-in is completed. Expanded by default, showing Plans tab.

**Structure:**
```html
<div class="collapsible-section expanded">
  <button class="collapse-toggle">
    <span class="toggle-icon">▼</span>
    Your plans & progress
  </button>
  
  <div class="collapsible-content">
    <div class="tab-buttons">
      <button class="tab active">Plans</button>
      <button class="tab">Progress</button>
    </div>
    <div class="tab-content">
      [Plans or Progress content]
    </div>
  </div>
</div>
```

**Styling:**
```css
.collapsible-section {
  margin-top: 16px;
}

.collapse-toggle {
  width: 100%;
  background: transparent;
  border: none;
  padding: 8px 0;
  font-size: 14px;
  font-weight: 600;
  color: #6B7280;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  transition: color 0.2s ease;
}

.collapse-toggle:hover {
  color: #1F2937;
}

.toggle-icon {
  transition: transform 0.3s ease;
}

.collapsible-section:not(.expanded) .toggle-icon {
  transform: rotate(-90deg);
}

.collapsible-content {
  background: rgba(255, 149, 0, 0.03);
  border-radius: 12px;
  padding: 16px;
  border-left: 3px solid #FF9500;
  margin-top: 8px;
}

.collapsible-section:not(.expanded) .collapsible-content {
  display: none;
}
```

**Tab Buttons:**
```css
.tab-buttons {
  display: flex;
  gap: 16px;
  margin-bottom: 12px;
  border-bottom: 2px solid rgba(0, 0, 0, 0.05);
}

.tab {
  background: transparent;
  border: none;
  padding: 8px 4px;
  font-size: 14px;
  font-weight: 600;
  color: #6B7280;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
  transition: all 0.2s ease;
}

.tab.active {
  color: #FF9500;
  border-bottom-color: #FF9500;
}

.tab:hover:not(.active) {
  color: #1F2937;
}
```

**State Persistence:**

Use sessionStorage to remember collapsed state within the same session:

```javascript
// On collapse/expand
const sectionId = `card-${section.id}-collapsed`;
sessionStorage.setItem(sectionId, isCollapsed.toString());

// On component mount
const wasCollapsed = sessionStorage.getItem(sectionId) === 'true';
```

This persists state through tab switches but resets each day (fresh session).

### Section Type Badges

Small pills indicating section type (Remote, Internship, Class).

```css
.section-badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.badge-remote {
  background: rgba(124, 58, 237, 0.12);
  color: #7C3AED;
}

.badge-internship {
  background: rgba(219, 39, 119, 0.12);
  color: #DB2777;
}

.badge-class {
  background: rgba(245, 158, 11, 0.12);
  color: #D97706;
}
```

---

## Interaction Patterns

### Check-In Flow (Required Sections)

**States:**
1. **Before Check-In**
   - Text: "Say you're here!" (visible, does not fade)
   - Button: 👋 (default state)
   - Hover: Button + emoji lift separately
   - Click: Button depresses, check-in prompt appears

2. **Check-In Prompt Open**
   - Prompt: "What are your plans for this session?"
   - Text input field
   - Buttons: Cancel | Submit
   - Cancel: Un-depress 👋 button, close prompt
   - Submit: Wave animation (2x), show "You're here.", activate ✌️ button

3. **After Check-In**
   - Text left: "You're here." (muted, `opacity: 0.5`)
   - Button: 👋 (pressed state)
   - Button: ✌️ (default state, newly visible)
   - Text right: "Say bye!"
   - Collapsible section: Plans & Progress (expanded, showing Plans)
   - Hover 👋: Still waves 2x (for fun)

4. **Check-Out Prompt Open**
   - Prompt: "What did you accomplish?"
   - Text input field
   - Buttons: Cancel | Submit
   - Cancel: Un-depress ✌️ button, close prompt
   - Submit: Peace sign rotates 360°, show "You're out!"

5. **After Check-Out**
   - Text left: (disappears or removed)
   - Button: 👋 (pressed state)
   - Button: ✌️ (pressed state)
   - Text right: "You're out!" (muted)
   - Collapsible section: Still available with both Plans and Progress tabs
   - Hover ✌️: Still waves 2x

### Presence Wave Flow (Optional Sections)

**States:**
1. **On Page Load**
   - Text: "Say hey!" fades in → visible 3 seconds → fades out
   - Button: 👋 (default state)
   - Hover: Button + emoji lift separately

2. **After Wave**
   - Text: (faded out, not visible)
   - Button: 👋 (pressed state)
   - Hover: Still waves 2x (for fun)
   - No collapsible section (presence waves don't have prompts)

**Key Differences from Check-In:**
- Text fades away (not persistent)
- No prompts or input fields
- No check-out button
- Simpler, more casual interaction

---

## Animation Principles

### Timing

- **Fast interactions:** `0.2s` (hover lifts, color changes)
- **Standard transitions:** `0.3s` (most state changes)
- **Deliberate animations:** `0.5-0.6s` (wave, peace rotation)
- **Text fades:** `0.6s` (fade in/out for presence text)

### Easing

- **Default:** `ease` (most transitions)
- **Lift/scale:** `ease-in-out` (smooth both directions)
- **Entrance:** `ease-out` (quick start, slow end)
- **Exit:** `ease-in` (slow start, quick end)

### Performance

- Use `transform` and `opacity` for animations (GPU-accelerated)
- Avoid animating `width`, `height`, `top`, `left` (causes reflow)
- Use `will-change` sparingly for complex animations only

---

## Accessibility Considerations

### Color Contrast

All text meets WCAG AA standards:
- Primary text (`#1F2937`) on white: 12.63:1 ✓
- Secondary text (`#6B7280`) on white: 5.74:1 ✓
- Accent colors on white: All meet 4.5:1 minimum for UI elements

### Interactive Elements

- Minimum touch target: 44x44px (emoji buttons are 64x64px ✓)
- Clear hover states for all clickable elements
- Keyboard navigation support required (focus states to be defined)
- ARIA labels for emoji-only buttons

### Animation

- Respect `prefers-reduced-motion` media query
- Critical animations (wave, peace) can be disabled if needed
- Text fades are cosmetic and can be instant for reduced motion

---

## Implementation Notes

### React Component Structure

Suggested component hierarchy for student agenda:

```
StudentAgenda (page)
├── DateNavigation
└── AgendaCard (for each section)
    ├── CardHeader
    │   ├── SectionInfo
    │   └── SectionBadge
    ├── ActionArea
    │   ├── ButtonText (conditional)
    │   ├── EmojiButton (👋)
    │   ├── EmojiButton (✌️, conditional)
    │   └── ButtonText (conditional)
    ├── CheckInPrompt (modal/inline, conditional)
    ├── CheckOutPrompt (modal/inline, conditional)
    └── CollapsibleSection (conditional)
        ├── CollapseToggle
        └── CollapsibleContent
            ├── TabButtons
            └── TabContent
```

### State Management

Each AgendaCard needs to track:
```typescript
interface CardState {
  hasWaved: boolean          // For presence waves
  isCheckedIn: boolean       // For required check-ins
  isCheckedOut: boolean      // For check-outs
  showCheckInPrompt: boolean // Prompt visibility
  showCheckOutPrompt: boolean
  isCollapsed: boolean       // Plans/Progress section
  activeTab: 'plans' | 'progress'
  plans: string | null       // User's response
  progress: string | null    // User's response
}
```

### Color Rotation Implementation

```javascript
// On page/component mount
const ACCENT_COLORS = ['#FF9500', '#7C3AED', '#DB2777', '#F59E0B'];
const startIndex = Math.floor(Math.random() * ACCENT_COLORS.length);

// Assign to each "here" instance
hereElements.forEach((element, index) => {
  const colorIndex = (startIndex + index) % ACCENT_COLORS.length;
  element.style.color = ACCENT_COLORS[colorIndex];
});
```

### SessionStorage Keys

Use consistent naming pattern:
```
agenda-card-{sectionId}-collapsed: 'true' | 'false'
```

Example:
```
agenda-card-remote-work-collapsed: 'true'
agenda-card-internship-coffee-collapsed: 'false'
```

---

## Future Considerations

### Not Yet Designed

The following elements will need design attention when implemented:

- **Navigation (sidebar/header)** - Apply color palette and spacing system
- **Teacher agenda cards** - Adapt patterns for teacher workflow
- **Form inputs** - Text inputs, textareas, dropdowns (used in prompts)
- **Modals/dialogs** - For complex interactions if needed
- **Loading states** - Spinners, skeletons, progress indicators
- **Empty states** - When no sections exist
- **Error states** - Validation, network errors

### Potential Enhancements

Ideas noted during design exploration:

- **Streak tracking** - "You've been HERE 13 days straight!" with special styling
- **Teacher acknowledgment** - "High five! 👋" from teachers
- **Greeting/farewell variety** - Rotate through different phrases ("Peace out!", "You're done!", etc.)
- **Seasonal themes** - Subtle seasonal touches to backgrounds/colors
- **Hover tooltips** - Show full responses on hover for collapsed sections

---

## Questions for Implementation

### To Be Decided

1. **Background orbs on cards:** Should they rotate through accent palette or match section type color?

2. **"Here" color matching:** Should "here" in a purple-badged section always be purple? Or continue independent rotation?

3. **Navigation styling:** Keep current layout and just update colors/spacing? Or redesign sidebar entirely?

4. **Prompt display:** Should check-in/out prompts be:
   - Inline within card (expands card height)
   - Modal overlay (separate from card)
   - Slide-in panel (from side or bottom)

5. **Mobile considerations:** Any specific mobile-first adjustments needed beyond responsive breakpoints?

6. **Form input styling:** What should text inputs, textareas, and buttons look like in prompts?

### Recommended Approach

Start with student agenda implementation using this design system. Gather feedback from real usage before finalizing decisions above. Teacher UI and navigation can adapt these patterns once student experience is validated.

---

## Version History

**v1.0 - January 29, 2026**
- Initial design system created
- Clean Bright direction established
- Color palette finalized (4-color rotation)
- "Here" treatment specified
- Agenda card components designed
- Emoji button interactions defined
- Animation specifications documented