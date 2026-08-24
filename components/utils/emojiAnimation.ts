// c:\Users\ultim\Music\intranet\PandaNet\components\utils\emojiAnimation.ts
import React from 'react';

/**
 * Triggers a floating emoji animation at the coordinates of the click event.
 * @param emoji The emoji string to animate (e.g. "👍", "❤️")
 * @param event The mouse click event
 */
export const triggerEmojiAnimation = (emoji: string, event: React.MouseEvent | MouseEvent) => {
  try {
    const x = event.clientX;
    const y = event.clientY;

    if (x === undefined || y === undefined) return;

    const container = document.createElement('div');
    container.className = 'animate-emoji-float';
    container.innerText = emoji;
    container.style.left = `${x - 20}px`;
    container.style.top = `${y - 40}px`;

    document.body.appendChild(container);

    setTimeout(() => {
      container.remove();
    }, 1000);
  } catch (err) {
    console.error('Error triggering emoji animation:', err);
  }
};
