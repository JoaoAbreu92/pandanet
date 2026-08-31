import type { KeyboardEvent } from 'react';

const NAVIGATION_KEYS = [
    'ArrowLeft',
    'ArrowRight',
    'Home',
    'End',
];

export const handleTabKeyDown = (
    event: KeyboardEvent<HTMLElement>
) => {
    if (!NAVIGATION_KEYS.includes(event.key)) {
        return;
    }

    const currentTab = event.currentTarget;
    const tabList = currentTab.closest('[role="tablist"]');

    if (!tabList) {
        return;
    }

    const enabledTabs = Array.from(
        tabList.querySelectorAll<HTMLElement>(
            '[role="tab"]:not([disabled]):not([aria-disabled="true"])'
        )
    );

    const currentIndex = enabledTabs.indexOf(currentTab);

    if (currentIndex === -1 || enabledTabs.length === 0) {
        return;
    }

    event.preventDefault();

    let nextIndex = currentIndex;

    if (event.key === 'Home') {
        nextIndex = 0;
    } else if (event.key === 'End') {
        nextIndex = enabledTabs.length - 1;
    } else if (event.key === 'ArrowRight') {
        nextIndex = (currentIndex + 1) % enabledTabs.length;
    } else if (event.key === 'ArrowLeft') {
        nextIndex =
            (currentIndex - 1 + enabledTabs.length) %
            enabledTabs.length;
    }

    const nextTab = enabledTabs[nextIndex];

    nextTab.focus();
    nextTab.click();
};
