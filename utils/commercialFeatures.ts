export const COMMERCIAL_FEATURE_IDS = [
    'whatspanda',
    'messages',
    'feed',
    'marketplace',
    'email',
    'calendar',
    'new_agenda',
    'reservations',
    'events',
    'projects',
    'wall',
    'org-chart',
    'meu-rh',
    'jobs',
    'training',
    'surveys',
    'benefits',
    'onboarding',
    'policies',
    'wellness',
    'tickets',
    'equip',
    'kb',
    'infosec',
    'scheduling',
    'crm',
    'kpis',
    'banners',
    'timebank',
    'performance',
    'employee_benefits',
    'ai_assistant'
] as const;

export const PAGE_FEATURE_MAP: Record<string, string> = {
    whatspanda: 'whatspanda',
    messages: 'messages',
    feed: 'feed',
    marketplace: 'marketplace',
    email: 'email',
    calendar: 'calendar',
    agenda: 'new_agenda',
    reservas: 'reservations',
    events: 'events',
    projects: 'projects',
    'projects-planning': 'projects',
    'projects-list': 'projects',
    'projects-calendar': 'projects',
    'projects-metrics': 'projects',
    recognition: 'wall',
    directory: 'org-chart',
    'org-chart': 'org-chart',
    'meu-rh': 'meu-rh',
    jobs: 'jobs',
    training: 'training',
    surveys: 'surveys',
    benefits: 'benefits',
    onboarding: 'onboarding',
    policies: 'policies',
    'bem-estar': 'wellness',
    'ti-dashboard': 'tickets',
    tickets: 'tickets',
    'ti-requests': 'equip',
    'knowledge-base': 'kb',
    infosec: 'infosec',
    scheduling: 'scheduling',
    'scheduling-events': 'scheduling'
};

export const resolveCommercialFeatures = (
    company: any
): Record<string, any> => {
    const disabledFeatures = Object.fromEntries(
        COMMERCIAL_FEATURE_IDS.map(featureId => [featureId, false])
    );

    if (!company?.plan) {
        return disabledFeatures;
    }

    return {
        ...disabledFeatures,
        ...(company.plan.features || {}),
        ...(company.custom_features || {})
    };
};

export const isCommercialFeatureEnabled = (
    features: Record<string, any> | null | undefined,
    featureId: string
): boolean => {
    const value = features?.[featureId];

    return value !== false
        && value !== 'disabled'
        && value !== undefined
        && value !== null;
};
