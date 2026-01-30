# Task: Convert Student Agenda to Tailwind CSS

**Priority:** High  
**Estimated Complexity:** Medium  
**Related Documentation:** `/docs/DESIGN_SYSTEM.md`, existing implementation in `/app/student/agenda/`

---

## Context

The student agenda was implemented using CSS-in-JS (styled-jsx) and CSS Modules, but the Here app project uses **Tailwind CSS** throughout. This is causing styling inconsistencies and breaking the visual design.

**Current problems:**
- EmojiButton.tsx uses `<style jsx>` tags (CSS-in-JS)
- AgendaCard.tsx and AgendaClient.tsx use CSS Modules (`.module.css` files)
- Styles are inconsistent across page refreshes
- Not following the project's established Tailwind pattern

**Goal:**
Convert all student agenda components to use Tailwind utility classes exclusively, with design system tokens defined in `globals.css`.

---

## Prerequisites

- [x] Design system documented in `/docs/DESIGN_SYSTEM.md`
- [x] Initial implementation complete (currently using CSS-in-JS)
- [x] Project uses Tailwind CSS (configured in `tailwind.config.ts`)

---

## Files to Modify

### Delete These Files:
1. `app/student/agenda/AgendaCard.module.css`
2. `app/student/agenda/AgendaClient.module.css`

### Modify These Files:
1. `app/globals.css` - Add design system CSS variables and keyframe animations
2. `app/student/agenda/EmojiButton.tsx` - Remove `<style jsx>`, add Tailwind classes
3. `app/student/agenda/AgendaCard.tsx` - Remove CSS Module import, add Tailwind classes
4. `app/student/agenda/AgendaClient.tsx` - Remove CSS Module import, add Tailwind classes
5. `app/student/agenda/CollapsibleSection.tsx` - Convert to Tailwind classes
6. `app/student/agenda/CheckInPrompt.tsx` - Convert to Tailwind classes
7. `app/student/agenda/CheckOutPrompt.tsx` - Convert to Tailwind classes

---

## Implementation Steps

### Step 1: Add Design System to globals.css

Add these CSS variables, custom classes, and animations to `app/globals.css`:

```css
/* ===== DESIGN SYSTEM - CLEAN BRIGHT ===== */

:root {
  /* Base Colors */
  --color-bg-primary: #FFFEF9;
  --color-bg-white: #FFFFFF;
  --color-text-primary: #1F2937;
  --color-text-secondary: #6B7280;
  --color-text-muted: #9CA3AF;
  
  /* Accent Colors (4-color palette) */
  --color-orange: #FF9500;
  --color-purple: #7C3AED;
  --color-pink: #DB2777;
  --color-yellow: #F59E0B;
  
  /* Section Type Colors */
  --color-remote: #7C3AED;
  --color-remote-bg: rgba(124, 58, 237, 0.12);
  --color-internship: #DB2777;
  --color-internship-bg: rgba(219, 39, 119, 0.12);
  --color-class: #F59E0B;
  --color-class-bg: rgba(245, 158, 11, 0.12);
  --color-class-text: #D97706;
}

/* Special "here" text treatment */
.here {
  font-weight: 700;
  /* Color assigned dynamically via JS */
}

.here:hover {
  background: linear-gradient(
    135deg,
    var(--color-orange) 0%,
    var(--color-purple) 33%,
    var(--color-pink) 66%,
    var(--color-yellow) 100%
  );
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-size: 200% 200%;
  animation: rainbowShimmer 1s ease-in-out;
}

/* Animation: Rainbow shimmer for "here" hover */
@keyframes rainbowShimmer {
  0% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0% 50%;
  }
}

/* Animation: Wave (for 👋 emoji) */
@keyframes wave {
  0%,
  100% {
    transform: rotate(0deg);
  }
  25% {
    transform: rotate(20deg);
  }
  50% {
    transform: rotate(0deg);
  }
  75% {
    transform: rotate(-20deg);
  }
}

.animate-wave {
  animation: wave 0.6s ease-in-out;
  animation-iteration-count: 2;
}

/* Animation: Peace rotation (for ✌️ emoji) */
@keyframes peaceRotate {
  0% {
    transform: rotate(0deg) scale(1);
  }
  50% {
    transform: rotate(180deg) scale(1.1);
  }
  100% {
    transform: rotate(360deg) scale(1);
  }
}

.animate-peace {
  animation: peaceRotate 0.5s ease-in-out;
}

/* Animation: Fade in text (for presence wave text) */
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

.animate-fade-in-text {
  animation: fadeInText 0.6s ease-out forwards;
}

/* Animation: Fade out text (for presence wave text) */
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

.animate-fade-out-text {
  animation: fadeOutText 0.6s ease-out forwards;
}
```

**Important:** Add this AFTER the existing Tailwind directives but BEFORE any other custom CSS in the file.

---

### Step 2: Convert EmojiButton.tsx to Tailwind

**Current file** uses `<style jsx>` tags.

**New implementation** should:
- Remove ALL `<style jsx>` blocks
- Use Tailwind utility classes for ALL styling
- Use custom animation classes from globals.css

**Key Tailwind classes to use:**

Base button:
```tsx
className={`
  w-16 h-16
  flex items-center justify-center
  rounded-2xl
  border-2
  cursor-pointer
  transition-all duration-300
  ${pressed 
    ? 'bg-gradient-to-br from-[#E8E0D5] to-[#D5CCBB] border-[rgba(255,149,0,0.15)] shadow-[inset_0_2px_8px_rgba(0,0,0,0.1)] translate-y-0.5' 
    : 'bg-gradient-to-br from-[#FFF5E8] to-[#FFE8CC] border-[rgba(255,149,0,0.2)] shadow-[0_4px_12px_rgba(255,149,0,0.15)] hover:shadow-[0_6px_20px_rgba(255,149,0,0.25)] hover:-translate-y-1'
  }
  ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
`}
```

Emoji span:
```tsx
className={`
  text-3xl inline-block transition-transform duration-200
  ${!pressed && !disabled ? 'group-hover:scale-110 group-hover:-translate-y-0.5' : ''}
  ${pressed && !disabled ? 'hover:scale-105' : ''}
  ${isAnimating && animationType === 'wave' ? 'animate-wave' : ''}
  ${isAnimating && animationType === 'peace' ? 'animate-peace' : ''}
`}
```

**Note:** Add `group` class to button element to enable `group-hover` on the emoji.

---

### Step 3: Convert AgendaCard.tsx to Tailwind

**Current file** imports `AgendaCard.module.css`.

**Changes needed:**
1. Remove: `import styles from './AgendaCard.module.css'`
2. Replace all `styles.className` with Tailwind classes
3. Delete `AgendaCard.module.css` file

**Key conversions:**

Card container:
```tsx
className="
  relative overflow-hidden mb-5
  bg-gradient-to-br from-[#FFFEF9] to-[#FFF8F0]
  rounded-[20px] p-6
  shadow-[0_4px_20px_rgba(0,0,0,0.06)]
  transition-all duration-300
  hover:shadow-[0_8px_30px_rgba(0,0,0,0.1)] hover:-translate-y-0.5
  before:absolute before:top-[-30px] before:right-[-30px]
  before:w-[120px] before:h-[120px]
  before:bg-[radial-gradient(circle,rgba(255,149,0,0.08)_0%,transparent_70%)]
  before:rounded-full before:pointer-events-none
"
```

Card header:
```tsx
className="flex justify-between items-start mb-5"
```

Card title:
```tsx
className="m-0 mb-1 text-lg font-bold text-[#1F2937]"
```

Card time:
```tsx
className="text-sm text-[#6B7280]"
```

Section badges:
```tsx
// Remote
className="inline-block px-3 py-1 rounded-lg text-xs font-semibold uppercase tracking-wider bg-[rgba(124,58,237,0.12)] text-[#7C3AED]"

// Internship
className="inline-block px-3 py-1 rounded-lg text-xs font-semibold uppercase tracking-wider bg-[rgba(219,39,119,0.12)] text-[#DB2777]"

// Class
className="inline-block px-3 py-1 rounded-lg text-xs font-semibold uppercase tracking-wider bg-[rgba(245,158,11,0.12)] text-[#D97706]"
```

Button area:
```tsx
className="flex items-center gap-4 flex-wrap"
```

Button text:
```tsx
className={`
  text-[15px] font-semibold text-[#1F2937]
  transition-opacity duration-600
  ${muted ? 'opacity-50' : ''}
  ${showWaveText ? 'animate-fade-in-text' : ''}
  ${hideWaveText ? 'animate-fade-out-text' : ''}
`}
```

---

### Step 4: Convert AgendaClient.tsx to Tailwind

**Current file** imports `AgendaClient.module.css`.

**Changes needed:**
1. Remove: `import styles from './AgendaClient.module.css'`
2. Replace all `styles.className` with Tailwind classes
3. Delete `AgendaClient.module.css` file

**Key conversions:**

Client container:
```tsx
className="max-w-3xl mx-auto px-6 py-6"
```

Date navigation:
```tsx
className="
  flex items-center justify-center gap-4 mb-8 p-5
  bg-gradient-to-br from-[#FFFEF9] to-[#FFF8F0]
  rounded-[20px]
  shadow-[0_2px_10px_rgba(0,0,0,0.05)]
"
```

Current date display:
```tsx
className="text-xl font-bold text-[#1F2937] min-w-[250px] text-center"
```

Navigation buttons (Previous/Next):
```tsx
className="
  px-5 py-2.5
  bg-transparent border-2 border-gray-200 rounded-xl
  text-sm font-semibold text-[#6B7280]
  cursor-pointer transition-all duration-200
  hover:bg-gray-50 hover:border-gray-300 hover:text-[#1F2937]
"
```

Today button:
```tsx
className="
  px-5 py-2.5
  bg-gradient-to-br from-[#FF9500] to-[#F59E0B]
  border-0 rounded-xl text-white
  text-sm font-semibold
  cursor-pointer transition-all duration-200
  shadow-[0_2px_8px_rgba(255,149,0,0.3)]
  hover:shadow-[0_4px_12px_rgba(255,149,0,0.4)] hover:-translate-y-0.5
"
```

Loading/Empty states:
```tsx
// Loading
className="text-center py-15 px-5 text-base text-[#6B7280]"

// Empty
className="text-center py-15 px-5"
// Paragraph inside:
className="text-base text-[#6B7280] m-0"
```

---

### Step 5: Convert CollapsibleSection.tsx to Tailwind

Review the current implementation and convert any inline styles or className strings to Tailwind classes.

**Key elements:**

Collapsible container:
```tsx
className="mt-4"
```

Toggle button:
```tsx
className="
  w-full bg-transparent border-0 py-2
  flex items-center gap-2
  text-sm font-semibold text-[#6B7280]
  cursor-pointer transition-colors duration-200
  hover:text-[#1F2937]
"
```

Toggle icon:
```tsx
className={`transition-transform duration-300 ${isExpanded ? '' : '-rotate-90'}`}
```

Collapsible content:
```tsx
className={`
  mt-2 p-4 rounded-xl
  bg-[rgba(255,149,0,0.03)]
  border-l-[3px] border-l-[#FF9500]
  ${isExpanded ? 'block' : 'hidden'}
`}
```

Tab buttons container:
```tsx
className="flex gap-4 mb-3 border-b-2 border-b-[rgba(0,0,0,0.05)]"
```

Individual tab button:
```tsx
className={`
  bg-transparent border-0 px-1 py-2
  text-sm font-semibold
  cursor-pointer transition-all duration-200
  border-b-2 -mb-0.5
  ${activeTab === 'plans' 
    ? 'text-[#FF9500] border-b-[#FF9500]' 
    : 'text-[#6B7280] border-b-transparent hover:text-[#1F2937]'
  }
`}
```

---

### Step 6: Convert CheckInPrompt.tsx to Tailwind

Review current implementation and ensure it uses Tailwind classes.

**Suggested structure:**

Prompt container (modal overlay or inline):
```tsx
className="mt-4 p-4 bg-white rounded-xl shadow-lg border border-gray-200"
```

Prompt text:
```tsx
className="text-base font-semibold text-[#1F2937] mb-3"
```

Textarea:
```tsx
className="
  w-full p-3 rounded-lg
  border-2 border-gray-200
  text-sm text-[#1F2937]
  transition-colors duration-200
  focus:border-[#FF9500] focus:outline-none
  resize-none
"
```

Button container:
```tsx
className="flex gap-3 justify-end mt-3"
```

Cancel button:
```tsx
className="
  px-4 py-2 rounded-lg
  bg-gray-100 text-[#6B7280]
  text-sm font-semibold
  cursor-pointer transition-all duration-200
  hover:bg-gray-200
"
```

Submit button:
```tsx
className="
  px-4 py-2 rounded-lg
  bg-gradient-to-br from-[#FF9500] to-[#F59E0B]
  text-white text-sm font-semibold
  cursor-pointer transition-all duration-200
  shadow-[0_2px_8px_rgba(255,149,0,0.3)]
  hover:shadow-[0_4px_12px_rgba(255,149,0,0.4)]
  disabled:opacity-50 disabled:cursor-not-allowed
"
```

---

### Step 7: Convert CheckOutPrompt.tsx to Tailwind

Same approach as CheckInPrompt - use Tailwind classes matching the design system.

Prompt should ask: **"What did you accomplish?"**

Use the same styling as CheckInPrompt for consistency.

---

## Testing Checklist

After conversion, verify:

### Visual Consistency
- [ ] Cards have cream gradient background
- [ ] Shadows and hover effects work correctly
- [ ] Section badges use correct colors at 12% opacity
- [ ] Emoji buttons are 64x64px with correct styling
- [ ] Text is readable and uses correct font weights
- [ ] Spacing matches design system (consistent gaps)

### Animations
- [ ] 👋 wave animation plays 2 times on click
- [ ] ✌️ peace rotation spins 360° on click
- [ ] Hover on emoji buttons shows lift effect
- [ ] "here" text shows rainbow shimmer on hover
- [ ] Presence wave text fades in and out correctly
- [ ] Collapsible section expands/collapses smoothly

### Functionality
- [ ] All interactions still work (check-in, check-out, waves)
- [ ] State management unchanged
- [ ] Server actions still trigger correctly
- [ ] No console errors
- [ ] No TypeScript errors

### Cross-Browser
- [ ] Test in Chrome (primary - Chromebooks)
- [ ] Styles apply consistently across page refreshes
- [ ] No flash of unstyled content (FOUC)

---

## Common Tailwind Patterns to Use

**Gradient backgrounds:**
```tsx
className="bg-gradient-to-br from-[#FFFEF9] to-[#FFF8F0]"
```

**Box shadows (use arbitrary values for exact matches):**
```tsx
className="shadow-[0_4px_20px_rgba(0,0,0,0.06)]"
```

**Custom colors (use arbitrary values for exact hex codes):**
```tsx
className="text-[#1F2937] bg-[#FF9500]"
```

**Transitions:**
```tsx
className="transition-all duration-300"
className="transition-transform duration-200"
className="transition-opacity duration-600"
```

**Pseudo-elements (for the card orb):**
```tsx
className="
  before:absolute before:top-[-30px] before:right-[-30px]
  before:w-[120px] before:h-[120px]
  before:bg-[radial-gradient(circle,rgba(255,149,0,0.08)_0%,transparent_70%)]
  before:rounded-full before:pointer-events-none
"
```

**Group hover (for parent-child hover interactions):**
```tsx
// Parent:
className="group ..."

// Child:
className="group-hover:scale-110 group-hover:-translate-y-0.5"
```

---

## Acceptance Criteria

- [ ] No `.module.css` files in `/app/student/agenda/`
- [ ] No `<style jsx>` blocks in any component
- [ ] All styling uses Tailwind utility classes
- [ ] Custom animations defined in `globals.css`
- [ ] Visual appearance matches original design
- [ ] All interactions work identically to before
- [ ] No TypeScript errors
- [ ] No console warnings about styling
- [ ] Styles are consistent across page refreshes

---

## Notes

**Why Tailwind?**
- The Here app project uses Tailwind throughout
- Mixing styling approaches causes inconsistencies
- Tailwind provides better tree-shaking and performance
- Easier to maintain with consistent patterns

**Arbitrary Values:**
For exact color matches and specific shadows, use Tailwind's arbitrary value syntax:
- Colors: `text-[#1F2937]`
- Shadows: `shadow-[0_4px_20px_rgba(0,0,0,0.06)]`
- Backgrounds: `bg-[#FFFEF9]`

**Custom Classes:**
Only use custom classes (defined in globals.css) for:
- Animations (keyframes can't be inlined)
- The special `.here` text treatment
- Complex pseudo-element styling if needed

Everything else should be Tailwind utilities.

---

## Estimated Time

- Step 1 (globals.css): 15 minutes
- Step 2 (EmojiButton): 20 minutes
- Step 3 (AgendaCard): 30 minutes
- Step 4 (AgendaClient): 20 minutes
- Step 5 (CollapsibleSection): 15 minutes
- Step 6-7 (Prompts): 20 minutes
- Testing: 20 minutes

**Total: ~2.5 hours**

---

## Definition of Done

- [ ] All components converted to Tailwind
- [ ] CSS Module files deleted
- [ ] No inline styles or CSS-in-JS
- [ ] globals.css updated with design system
- [ ] All tests passing
- [ ] Visual QA complete
- [ ] No console errors
- [ ] Code committed with clear message

**Commit message suggestion:**
```
refactor(agenda): convert student agenda to Tailwind CSS

- Remove CSS Modules and CSS-in-JS (styled-jsx)
- Convert all components to Tailwind utility classes
- Add design system tokens to globals.css
- Maintain all functionality and animations
```
