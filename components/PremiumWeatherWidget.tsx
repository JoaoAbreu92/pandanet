import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState
} from 'react';
import { createPortal } from 'react-dom';

type Coordinates = {
    latitude: number;
    longitude: number;
    label: string;
    automatic: boolean;
};

type WeatherData = {
    current: {
        time: string;
        temperature_2m: number;
        apparent_temperature: number;
        precipitation: number;
        weather_code: number;
        wind_speed_10m: number;
        is_day: number;
    };
    hourly: {
        time: string[];
        temperature_2m: number[];
        precipitation_probability: number[];
        weather_code: number[];
        is_day: number[];
    };
    daily: {
        temperature_2m_max: number[];
        temperature_2m_min: number[];
        precipitation_probability_max: number[];
    };
};

type CachedWeather = {
    savedAt: number;
    data: WeatherData;
};

interface PremiumWeatherWidgetProps {
    userId: string;
}

const DEFAULT_COORDINATES: Coordinates = {
    latitude: -23.5505,
    longitude: -46.6333,
    label: 'São Paulo · SP',
    automatic: false
};

const weatherDescription = (code: number) => {
    if (code === 0) return 'Céu limpo';
    if ([1, 2].includes(code)) return 'Parcialmente nublado';
    if (code === 3) return 'Nublado';
    if ([45, 48].includes(code)) return 'Neblina';
    if ([51, 53, 55, 56, 57].includes(code)) return 'Garoa';
    if (
        [61, 63, 65, 66, 67, 80, 81, 82].includes(code)
    ) {
        return 'Chuva';
    }
    if ([71, 73, 75, 77, 85, 86].includes(code)) {
        return 'Neve';
    }
    if ([95, 96, 99].includes(code)) return 'Tempestade';
    return 'Tempo variável';
};

const weatherIcon = (code: number, isDay: boolean) => {
    if (code === 0) return isDay ? '☀️' : '🌙';
    if ([1, 2].includes(code)) return isDay ? '🌤️' : '☁️';
    if ([3, 45, 48].includes(code)) return '☁️';
    if (
        [
            51, 53, 55, 56, 57,
            61, 63, 65, 66, 67,
            80, 81, 82
        ].includes(code)
    ) {
        return '🌧️';
    }
    if ([71, 73, 75, 77, 85, 86].includes(code)) {
        return '🌨️';
    }
    if ([95, 96, 99].includes(code)) return '⛈️';
    return '⛅';
};

const wait = (milliseconds: number) =>
    new Promise(resolve =>
        window.setTimeout(resolve, milliseconds)
    );

const PremiumWeatherWidget: React.FC<
    PremiumWeatherWidgetProps
> = ({ userId }) => {
    const locationKey =
        `pandanet_weather_location_${userId}`;

    const [coordinates, setCoordinates] =
        useState<Coordinates>(() => {
            try {
                const saved = localStorage.getItem(locationKey);
                return saved
                    ? JSON.parse(saved)
                    : DEFAULT_COORDINATES;
            } catch {
                return DEFAULT_COORDINATES;
            }
        });

    const [hasSavedLocation, setHasSavedLocation] =
        useState(() =>
            Boolean(localStorage.getItem(locationKey))
        );

    const [weather, setWeather] =
        useState<WeatherData | null>(null);

    const [loading, setLoading] = useState(true);
    const [locationLoading, setLocationLoading] =
        useState(false);

    const [statusMessage, setStatusMessage] = useState('');
    const [updatedAt, setUpdatedAt] =
        useState<Date | null>(null);

    const [manualOpen, setManualOpen] = useState(false);
    const [manualAddress, setManualAddress] = useState('');
    const [manualError, setManualError] = useState('');

    const mountedRef = useRef(true);

    const saveCoordinates = useCallback((
        next: Coordinates
    ) => {
        setCoordinates(next);
        setHasSavedLocation(true);

        localStorage.setItem(
            locationKey,
            JSON.stringify(next)
        );
    }, [locationKey]);

    const requestAutomaticLocation = useCallback(() => {
        if (!navigator.geolocation) {
            saveCoordinates(DEFAULT_COORDINATES);
            return;
        }

        setLocationLoading(true);

        navigator.geolocation.getCurrentPosition(
            position => {
                if (!mountedRef.current) return;

                saveCoordinates({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    label: 'Localização atual',
                    automatic: true
                });

                setLocationLoading(false);
            },
            () => {
                if (!mountedRef.current) return;

                saveCoordinates(DEFAULT_COORDINATES);
                setLocationLoading(false);
            },
            {
                enableHighAccuracy: false,
                timeout: 10000,
                maximumAge: 30 * 60 * 1000
            }
        );
    }, [saveCoordinates]);

    useEffect(() => {
        if (!hasSavedLocation) {
            requestAutomaticLocation();
        }
    }, [
        hasSavedLocation,
        requestAutomaticLocation
    ]);

    const cacheKey = useMemo(
        () =>
            'pandanet_weather_' +
            coordinates.latitude.toFixed(2) +
            '_' +
            coordinates.longitude.toFixed(2),
        [coordinates]
    );

    const requestForecast = useCallback(async () => {
        const params = new URLSearchParams({
            latitude: String(coordinates.latitude),
            longitude: String(coordinates.longitude),
            current: [
                'temperature_2m',
                'apparent_temperature',
                'precipitation',
                'weather_code',
                'wind_speed_10m',
                'is_day'
            ].join(','),
            hourly: [
                'temperature_2m',
                'precipitation_probability',
                'weather_code',
                'is_day'
            ].join(','),
            daily: [
                'temperature_2m_max',
                'temperature_2m_min',
                'precipitation_probability_max'
            ].join(','),
            timezone: 'auto',
            forecast_days: '2'
        });

        const controller = new AbortController();

        const timeout = window.setTimeout(
            () => controller.abort(),
            14000
        );

        try {
            const response = await fetch(
                'https://api.open-meteo.com/v1/forecast?' +
                params.toString(),
                {
                    signal: controller.signal,
                    cache: 'no-store',
                    headers: {
                        Accept: 'application/json'
                    }
                }
            );

            if (!response.ok) {
                throw new Error(
                    `Falha meteorológica: ${response.status}`
                );
            }

            const data =
                await response.json() as WeatherData;

            if (
                !data?.current ||
                !data?.hourly ||
                !data?.daily
            ) {
                throw new Error('Previsão incompleta');
            }

            return data;
        } finally {
            window.clearTimeout(timeout);
        }
    }, [coordinates]);

    const loadWeather = useCallback(async (
        silent = false
    ) => {
        if (!silent) setLoading(true);
        setStatusMessage('');

        let cached: CachedWeather | null = null;

        try {
            const stored = localStorage.getItem(cacheKey);

            if (stored) {
                cached = JSON.parse(stored);

                if (
                    cached?.data &&
                    cached?.savedAt &&
                    Date.now() - cached.savedAt <
                        20 * 60 * 1000
                ) {
                    if (!mountedRef.current) return;

                    setWeather(cached.data);
                    setUpdatedAt(new Date(cached.savedAt));
                    setLoading(false);
                    return;
                }
            }
        } catch {
            cached = null;
        }

        try {
            let data: WeatherData;

            try {
                data = await requestForecast();
            } catch {
                await wait(850);
                data = await requestForecast();
            }

            if (!mountedRef.current) return;

            const savedAt = Date.now();

            setWeather(data);
            setUpdatedAt(new Date(savedAt));

            localStorage.setItem(
                cacheKey,
                JSON.stringify({
                    savedAt,
                    data
                })
            );
        } catch (requestError) {
            console.error(
                'Falha ao carregar clima:',
                requestError
            );

            if (!mountedRef.current) return;

            if (cached?.data) {
                setWeather(cached.data);
                setUpdatedAt(
                    new Date(cached.savedAt || Date.now())
                );
                setStatusMessage(
                    'Última previsão disponível'
                );
            } else {
                setWeather(null);
                setStatusMessage(
                    'Clima temporariamente indisponível'
                );
            }
        } finally {
            if (mountedRef.current) {
                setLoading(false);
            }
        }
    }, [cacheKey, requestForecast]);

    useEffect(() => {
        mountedRef.current = true;
        void loadWeather();

        const interval = window.setInterval(
            () => void loadWeather(true),
            20 * 60 * 1000
        );

        return () => {
            mountedRef.current = false;
            window.clearInterval(interval);
        };
    }, [loadWeather]);

    const handleManualLocation = async (
        event: React.FormEvent
    ) => {
        event.preventDefault();

        const address = manualAddress.trim();

        if (address.length < 3) {
            setManualError(
                'Digite uma cidade, bairro ou endereço válido.'
            );
            return;
        }

        setLocationLoading(true);
        setManualError('');

        const controller = new AbortController();

        const timeout = window.setTimeout(
            () => controller.abort(),
            12000
        );

        try {
            const response = await fetch(
                'https://geocoding-api.open-meteo.com/v1/search?' +
                new URLSearchParams({
                    name: address,
                    count: '1',
                    language: 'pt',
                    format: 'json'
                }).toString(),
                {
                    signal: controller.signal,
                    headers: {
                        Accept: 'application/json'
                    }
                }
            );

            if (!response.ok) {
                throw new Error('Falha na busca');
            }

            const result = await response.json();
            const place = result?.results?.[0];

            if (!place) {
                throw new Error('Local não encontrado');
            }

            const label = [
                place.name,
                place.admin1,
                place.country_code
            ].filter(Boolean).join(' · ');

            saveCoordinates({
                latitude: Number(place.latitude),
                longitude: Number(place.longitude),
                label: label || address,
                automatic: false
            });

            setManualAddress('');
            setManualOpen(false);
        } catch (locationError) {
            console.error(
                'Falha ao buscar endereço:',
                locationError
            );

            setManualError(
                'Local não encontrado. Informe cidade e estado.'
            );
        } finally {
            window.clearTimeout(timeout);
            setLocationLoading(false);
        }
    };

    const forecast = useMemo(() => {
        if (!weather) return [];

        const currentTime =
            new Date(weather.current.time).getTime();

        let start = weather.hourly.time.findIndex(time =>
            new Date(time).getTime() >= currentTime
        );

        if (start < 0) start = 0;

        return [0, 3, 6].map(offset => {
            const index = Math.min(
                start + offset,
                weather.hourly.time.length - 1
            );

            return {
                time: weather.hourly.time[index],
                temperature:
                    weather.hourly.temperature_2m[index],
                rain:
                    weather.hourly
                        .precipitation_probability[index] || 0,
                code:
                    weather.hourly.weather_code[index],
                isDay:
                    weather.hourly.is_day[index] === 1
            };
        });
    }, [weather]);

    const locationDialog = manualOpen
        ? createPortal(
            <div className="weather-location-overlay">
                <form
                    className="weather-location-dialog"
                    onSubmit={handleManualLocation}
                >
                    <header>
                        <span>
                            <strong>
                                Escolher local da previsão
                            </strong>
                            <small>
                                Informe uma cidade, bairro ou endereço.
                            </small>
                        </span>

                        <button
                            type="button"
                            onClick={() => {
                                setManualOpen(false);
                                setManualError('');
                            }}
                            aria-label="Fechar"
                        >
                            ×
                        </button>
                    </header>

                    <input
                        value={manualAddress}
                        onChange={event =>
                            setManualAddress(
                                event.target.value
                            )
                        }
                        placeholder="Ex.: Campinas, SP"
                        autoFocus
                    />

                    {manualError && (
                        <p>{manualError}</p>
                    )}

                    <footer>
                        <button
                            type="button"
                            onClick={() =>
                                requestAutomaticLocation()
                            }
                            disabled={locationLoading}
                        >
                            Usar localização atual
                        </button>

                        <button
                            type="submit"
                            disabled={locationLoading}
                        >
                            {locationLoading
                                ? 'Buscando…'
                                : 'Usar endereço'}
                        </button>
                    </footer>
                </form>
            </div>,
            document.body
        )
        : null;

    if (loading && !weather) {
        return (
            <>
                <section className="compact-weather-capsule weather-loading">
                    <span className="weather-loading-dot" />
                    <span>Organizando a previsão do tempo…</span>
                </section>
                {locationDialog}
            </>
        );
    }

    if (!weather) {
        return (
            <>
                <section className="compact-weather-capsule weather-unavailable">
                    <span>☁️</span>

                    <div>
                        <strong>
                            {statusMessage ||
                                'Clima indisponível'}
                        </strong>
                        <small>{coordinates.label}</small>
                    </div>

                    <div className="weather-unavailable-actions">
                        <button
                            type="button"
                            onClick={() =>
                                void loadWeather()
                            }
                        >
                            Tentar novamente
                        </button>

                        <button
                            type="button"
                            onClick={() =>
                                setManualOpen(true)
                            }
                        >
                            Informar endereço
                        </button>
                    </div>
                </section>
                {locationDialog}
            </>
        );
    }

    const description = weatherDescription(
        weather.current.weather_code
    );

    return (
        <>
            <section className="compact-weather-capsule">
                <div className="compact-weather-current">
                    <span className="compact-weather-main-icon">
                        {weatherIcon(
                            weather.current.weather_code,
                            weather.current.is_day === 1
                        )}
                    </span>

                    <span className="compact-weather-current-copy">
                        <span>
                            <strong className="compact-weather-temperature">
                                {Math.round(
                                    weather.current
                                        .temperature_2m
                                )}°
                            </strong>
                            <small>{description}</small>
                        </span>

                        <span className="compact-weather-location">
                            <span title={coordinates.label}>
                                {coordinates.label}
                            </span>
                            <button
                                type="button"
                                onClick={() =>
                                    setManualOpen(true)
                                }
                            >
                                Editar
                            </button>
                        </span>
                    </span>
                </div>

                <div className="compact-weather-details">
                    <span>
                        <small>Máx / mín</small>
                        <strong>
                            {Math.round(
                                weather.daily
                                    .temperature_2m_max[0]
                            )}° /{' '}
                            {Math.round(
                                weather.daily
                                    .temperature_2m_min[0]
                            )}°
                        </strong>
                    </span>

                    <span>
                        <small>Chuva</small>
                        <strong>
                            {weather.daily
                                .precipitation_probability_max[0] ||
                                0}%
                        </strong>
                    </span>

                    <span>
                        <small>Vento</small>
                        <strong>
                            {Math.round(
                                weather.current
                                    .wind_speed_10m
                            )} km/h
                        </strong>
                    </span>
                </div>

                <div className="compact-weather-hours">
                    {forecast.map(hour => (
                        <div key={hour.time}>
                            <small>
                                {new Date(
                                    hour.time
                                ).toLocaleTimeString(
                                    'pt-BR',
                                    {
                                        hour: '2-digit',
                                        minute: '2-digit'
                                    }
                                )}
                            </small>
                            <span>
                                {weatherIcon(
                                    hour.code,
                                    hour.isDay
                                )}
                            </span>
                            <strong>
                                {Math.round(
                                    hour.temperature
                                )}°
                            </strong>
                        </div>
                    ))}
                </div>

                <span className="compact-weather-updated">
                    {statusMessage ||
                        (updatedAt
                            ? `Atualizado ${updatedAt.toLocaleTimeString(
                                'pt-BR',
                                {
                                    hour: '2-digit',
                                    minute: '2-digit'
                                }
                            )}`
                            : '')}
                </span>
            </section>

            {locationDialog}
        </>
    );
};

export default PremiumWeatherWidget;
