/**
 * Animation utilities for cascading, staggered animations
 */

/**
 * Get cascade animation class based on index
 * Usage: className={getAnimationCascadeClass(index)}
 */
export function getAnimationCascadeClass(index) {
  const cascadeClasses = [
    'animate-cascade-1',
    'animate-cascade-2',
    'animate-cascade-3',
    'animate-cascade-4',
    'animate-cascade-5',
    'animate-cascade-6',
  ];
  return cascadeClasses[index % cascadeClasses.length];
}

/**
 * Get cascade classes for multiple items
 * Usage: const classes = getAnimationCascadeClasses(5) // returns array of 6 classes
 */
export function getAnimationCascadeClasses(count) {
  return Array.from({ length: count }, (_, i) => getAnimationCascadeClass(i));
}

/**
 * Apply CSS animation to element
 * Usage: applyAnimation(element, 'fadeInUp', 400)
 */
export function applyAnimation(element, animationName, duration = 400) {
  if (!element) return;
  element.classList.add(`animate-${animationName}`);
  setTimeout(() => {
    element.classList.remove(`animate-${animationName}`);
  }, duration);
}

/**
 * Trigger shake animation on element
 * Usage: triggerShake(inputRef.current)
 */
export function triggerShake(element) {
  if (!element) return;
  element.classList.add('animate-shakeWarn');
  setTimeout(() => {
    element.classList.remove('animate-shakeWarn');
  }, 600);
}

/**
 * Trigger spin animation on element
 * Usage: triggerSpin(iconRef.current)
 */
export function triggerSpin(element) {
  if (!element) return;
  element.classList.add('animate-spin');
  const removeSpinClass = () => element.classList.remove('animate-spin');
  const timeout = setTimeout(removeSpinClass, 1000);
  return () => clearTimeout(timeout);
}

/**
 * Create staggered animation for array of elements
 * Usage: createStaggeredAnimation(listItems, 'fadeInUp', 50)
 */
export function createStaggeredAnimation(elements, animationName, delayMs = 50) {
  if (!Array.isArray(elements)) return;
  elements.forEach((element, index) => {
    if (element) {
      setTimeout(() => {
        element.classList.add(`animate-${animationName}`);
      }, index * delayMs);
    }
  });
}

/**
 * Remove animation class after completion
 * Usage: waitAnimationEnd(element, 'slideOutRight').then(() => console.log('done'))
 */
export function waitAnimationEnd(element, animationName) {
  return new Promise((resolve) => {
    if (!element) {
      resolve();
      return;
    }
    element.classList.add(`animate-${animationName}`);
    const animationDuration = getAnimationDuration(animationName);
    setTimeout(() => {
      element.classList.remove(`animate-${animationName}`);
      resolve();
    }, animationDuration);
  });
}

/**
 * Get animation duration based on animation name
 */
function getAnimationDuration(animationName) {
  const durations = {
    fadeInUp: 400,
    fadeInDown: 400,
    fadeInScale: 500,
    fadeInCascade: 500,
    slideOutRight: 400,
    slideInLeft: 400,
    slideDown: 300,
    slideUp: 300,
    shake: 500,
    shakeWarn: 600,
    spin: 1000,
    spinBounce: 1500,
    drawBars: 500,
  };
  return durations[animationName] || 400;
}
