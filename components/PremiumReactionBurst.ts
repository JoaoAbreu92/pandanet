const PARTICLE_COLORS = [
    '#10b981',
    '#22d3ee',
    '#60a5fa',
    '#a78bfa',
    '#f472b6',
    '#facc15',
    '#fb7185',
    '#34d399'
];

export const launchPremiumReaction = (
    emoji: string,
    anchor?: HTMLElement | null
) => {
    if (
        typeof window === 'undefined'
        || typeof document === 'undefined'
        || window.matchMedia(
            '(prefers-reduced-motion: reduce)'
        ).matches
    ) {
        return;
    }

    const rectangle = anchor?.getBoundingClientRect();

    const centerX = rectangle
        ? rectangle.left + rectangle.width / 2
        : window.innerWidth / 2;

    const centerY = rectangle
        ? rectangle.top + rectangle.height / 2
        : window.innerHeight / 2;

    const effect = document.createElement('div');
    effect.className = 'premium-reaction-burst';
    effect.style.left = `${centerX}px`;
    effect.style.top = `${centerY}px`;
    effect.setAttribute('aria-hidden', 'true');

    const halo = document.createElement('span');
    halo.className = 'premium-reaction-burst__halo';
    effect.appendChild(halo);

    const ring = document.createElement('span');
    ring.className = 'premium-reaction-burst__ring';
    effect.appendChild(ring);

    const mainEmoji = document.createElement('span');
    mainEmoji.className = 'premium-reaction-burst__emoji';
    mainEmoji.textContent = emoji;
    effect.appendChild(mainEmoji);

    for (let index = 0; index < 14; index++) {
        const angle =
            (Math.PI * 2 * index) / 14
            + (Math.random() - 0.5) * 0.24;

        const distance =
            52 + Math.random() * 46;

        const particle = document.createElement('span');

        particle.className =
            index % 4 === 0
                ? 'premium-reaction-burst__mini'
                : 'premium-reaction-burst__particle';

        particle.textContent =
            index % 4 === 0 ? emoji : '';

        particle.style.setProperty(
            '--reaction-x',
            `${Math.cos(angle) * distance}px`
        );

        particle.style.setProperty(
            '--reaction-y',
            `${Math.sin(angle) * distance}px`
        );

        particle.style.setProperty(
            '--reaction-delay',
            `${Math.round(Math.random() * 85)}ms`
        );

        particle.style.setProperty(
            '--reaction-color',
            PARTICLE_COLORS[
                index % PARTICLE_COLORS.length
            ]
        );

        effect.appendChild(particle);
    }

    document.body.appendChild(effect);

    if (typeof navigator.vibrate === 'function') {
        navigator.vibrate(18);
    }

    window.setTimeout(() => effect.remove(), 1300);
};
