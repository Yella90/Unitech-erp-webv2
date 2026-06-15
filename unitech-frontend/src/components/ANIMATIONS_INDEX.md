# Animation Components Index

## Quick Import Guide

```jsx
// Buttons
import { RippleButton } from '../components/RippleButton';

// Modals
import { ConfirmationModal } from '../components/ConfirmationModal';

// Highlighting
import { HighlightRow, HighlightCell, HighlightDiv } from '../components/HighlightAnimated';

// Tabs
import { AnimatedTabs } from '../components/AnimatedTabs';

// Forms
import { FormInput, FormSelect, FormTextarea } from '../components/FormInput';

// Loaders
import { LoadingSpinner, LoadingOverlay, SkeletonLoading, ProgressBar, CircleProgressBar } from '../components/Loaders';

// Utilities
import { getAnimationCascadeClass, applyAnimation, triggerShake, triggerSpin } from '../utils/animations';
```

## Component Reference

### RippleButton
**Purpose**: Button with ripple effect on click  
**Variants**: primary, secondary, danger  
**Props**: onClick, variant, disabled, className, type  

```jsx
<RippleButton 
  variant="primary" 
  onClick={handleDownload}
  title="Download as PDF"
>
  📥 Download
</RippleButton>
```

### ConfirmationModal
**Purpose**: Confirmation dialog with fade animation  
**Props**: isOpen, title, message, confirmLabel, cancelLabel, isDangerous, isLoading, onConfirm, onCancel  

```jsx
<ConfirmationModal
  isOpen={showModal}
  title="Delete item?"
  message="This action cannot be undone."
  isDangerous={true}
  isLoading={isDeleting}
  onConfirm={handleDelete}
  onCancel={() => setShowModal(false)}
/>
```

### HighlightRow / HighlightCell / HighlightDiv
**Purpose**: Highlight new items with yellow background that fades  
**Props**: isNew, duration (ms), className  

```jsx
<HighlightRow isNew={true} duration={2000}>
  <td>New item</td>
</HighlightRow>
```

### AnimatedTabs
**Purpose**: Tab navigation with fade animation on content  
**Props**: tabs (array), defaultTabId, onTabChange  

```jsx
<AnimatedTabs
  tabs={[
    { id: 'info', label: 'Informations', content: <InfoPanel /> },
    { id: 'payments', label: 'Paiements', content: <PaymentsPanel /> },
  ]}
  defaultTabId="info"
  onTabChange={(tabId) => console.log(tabId)}
/>
```

### FormInput / FormSelect / FormTextarea
**Purpose**: Form fields with error shake animation  
**Props**: label, error, onErrorShake, required, ... standard input attributes  

```jsx
<FormInput
  label="Email"
  type="email"
  value={email}
  onChange={handleChange}
  error={errors.email}
  required
/>
```

### LoadingSpinner
**Purpose**: Spinning loader icon  
**Props**: size (sm/md/lg), color (Tailwind class)  

```jsx
<LoadingSpinner size="lg" color="text-indigo-600" />
```

### LoadingOverlay
**Purpose**: Full-screen loading overlay  
**Props**: isVisible, message  

```jsx
<LoadingOverlay isVisible={isLoading} message="Generating PDF..." />
```

### ProgressBar
**Purpose**: Linear progress indicator  
**Props**: value (0-100), animated  

```jsx
<ProgressBar value={65} animated={true} />
```

### CircleProgressBar
**Purpose**: Circular progress indicator  
**Props**: value (0-100), size (px), label  

```jsx
<CircleProgressBar value={45} size={80} label="Upload progress" />
```

## Utility Functions

### getAnimationCascadeClass(index)
Returns cascade animation class for staggered display

```jsx
{items.map((item, idx) => (
  <Card className={getAnimationCascadeClass(idx)}>
    {item.name}
  </Card>
))}
```

### applyAnimation(element, name, duration)
Apply animation programmatically

```jsx
const handleRefresh = () => {
  applyAnimation(iconRef.current, 'spin', 1000);
};
```

### triggerShake(element)
Shake an element (useful for errors)

```jsx
const handleError = () => {
  triggerShake(formRef.current);
};
```

### triggerSpin(element)
Spin an element (useful for loading)

```jsx
const handleSync = () => {
  triggerSpin(syncIconRef.current);
};
```

## CSS Classes Available

### Fade Animations
- `animate-fadeInUp` - Fade in from bottom
- `animate-fadeInDown` - Fade in from top
- `animate-fadeInScale` - Fade in with scale
- `animate-fadeInCascade` - Fade in with cascade

### Slide Animations
- `animate-slideDown` - Slide down
- `animate-slideUp` - Slide up
- `animate-slideInLeft` - Slide in from left
- `animate-slideOutRight` - Slide out right

### Motion Effects
- `animate-shake` - Shake animation
- `animate-shakeWarn` - Stronger shake (warnings)
- `animate-spin` - Rotate 360°
- `animate-spinBounce` - Rotate with bounce

### Transitions
- `transition-all-smooth` - Smooth all properties
- `transition-opacity-smooth` - Smooth opacity
- `transition-transform-smooth` - Smooth transforms
- `transition-colors-smooth` - Smooth colors

## Performance Tips

✅ Use `transform` and `opacity` only (GPU accelerated)  
✅ Keep animations between 150-500ms  
✅ Use cascade delays for lists (50ms stagger)  
✅ Animations respect `prefers-reduced-motion`  
❌ Avoid animating `width`, `height`, `left`, `right` (causes reflow)  

## Browser Support

All animations use standard CSS3 and are supported in:
- Chrome 60+
- Firefox 55+
- Safari 12.1+
- Edge 79+

Modern usage of `transform` and `opacity` ensures smooth 60fps performance on mobile.
