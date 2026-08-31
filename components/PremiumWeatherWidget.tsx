import React, { useCallback, useEffect, useMemo, useState } from 'react';

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
        relative_humidity_2m: number;
        precipitation: number;
        weather_code: number;
        cloud_cover: number;
        wind_speed_10m: number;
        wind_gusts_10m: number;
        is_day: number;
    };
    hourly: {
        time: string[];
        temperature_2m: number[];
        precipitation_probability: number[];
        weather_code: number[];
        is_day: number[];
        wind_speed_10m: number[];
    };
    daily: {
        temperature_2m_max: number[];
        temperature_2m_min: number[];
        precipitation_probability_max: number[];
    };
};

type WeatherVisual = {
    label: string;
    kind: 'sun' | 'cloud' | 'rain' | 'storm' | 'snow' | 'hail' | 'fog' | 'wind' | 'moon';
};

const weatherVisual = (code: number, isDay: boolean, wind = 0): WeatherVisual => {
    if (wind >= 55) return { label: 'Ventania', kind: 'wind' };
    if (code === 0) return isDay
        ? { label: 'Céu limpo', kind: 'sun' }
        : { label: 'Noite limpa', kind: 'moon' };
    if ([1, 2, 3].includes(code)) return { label: code === 3 ? 'Nublado' : 'Parcialmente nublado', kind: 'cloud' };
    if ([45, 48].includes(code)) return { label: 'Neblina', kind: 'fog' };
    if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) {
        return { label: code >= 80 ? 'Pancadas de chuva' : 'Chuva', kind: 'rain' };
    }
    if ([71, 73, 75, 77, 85, 86].includes(code)) return { label: 'Neve', kind: 'snow' };
    if ([95, 96, 99].includes(code)) {
        return code >= 96
            ? { label: 'Tempestade com granizo', kind: 'hail' }
            : { label: 'Tempestade', kind: 'storm' };
    }
    return { label: 'Tempo variável', kind: 'cloud' };
};

const WeatherScene: React.FC<{
    kind: WeatherVisual['kind'];
    compact?: boolean;
}> = ({ kind, compact = false }) => (
    <div
        aria-hidden="true"
        className={compact ? 'pw-scene pw-scene-small' : 'pw-scene'}
    >
        {(kind === 'sun' || kind === 'cloud' || kind === 'rain') && (
            <div className="pw-sun">
                <div className="pw-rays" />
            </div>
        )}

        {kind === 'moon' && (
            <div className="pw-moon">
                <span />
            </div>
        )}

        {['cloud', 'rain', 'storm', 'snow', 'hail'].includes(kind) && (
            <div className="pw-cloud">
                <span className="pw-cloud-a" />
                <span className="pw-cloud-b" />
                <span className="pw-cloud-c" />
            </div>
        )}

        {(kind === 'rain' || kind === 'storm') && (
            <div className="pw-rain">
                <i /><i /><i /><i /><i />
            </div>
        )}

        {kind === 'storm' && <div className="pw-lightning" />}

        {kind === 'snow' && (
            <div className="pw-snow">
                <i>✦</i><i>✦</i><i>✦</i><i>✦</i>
            </div>
        )}

        {kind === 'hail' && (
            <>
                <div className="pw-lightning" />
                <div className="pw-hail">
                    <i /><i /><i /><i />
                </div>
            </>
        )}

        {kind === 'fog' && (
            <div className="pw-fog">
                <i /><i /><i />
            </div>
        )}

        {kind === 'wind' && (
            <div className="pw-wind">
                <i /><i /><i /><i />
            </div>
        )}
    </div>
);

interface PremiumWeatherWidgetProps {
    userId: string;
}

const DEFAULT_COORDINATES: Coordinates = {
    latitude: -23.5505,
    longitude: -46.6333,
    label: 'São Paulo · referência',
    automatic: false
};

const PremiumWeatherWidget: React.FC<PremiumWeatherWidgetProps> = ({
    userId
}) => {
    const locationStorageKey =
        'pandanet_weather_location_' + userId;

    const [coordinates, setCoordinates] = useState<Coordinates>(() => {
        try {
            const saved = localStorage.getItem(locationStorageKey);
            return saved ? JSON.parse(saved) : DEFAULT_COORDINATES;
        } catch {
            return DEFAULT_COORDINATES;
        }
    });

    const [hasSavedLocation, setHasSavedLocation] = useState(() =>
        Boolean(localStorage.getItem(locationStorageKey))
    );

    const [weather, setWeather] = useState<WeatherData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
    const [locationLoading, setLocationLoading] = useState(false);

    const requestLocation = useCallback(() => {
        if (!navigator.geolocation) {
            localStorage.setItem(
                locationStorageKey,
                JSON.stringify(DEFAULT_COORDINATES)
            );
            setHasSavedLocation(true);
            return;
        }

        setLocationLoading(true);

        navigator.geolocation.getCurrentPosition(
            position => {
                const detected: Coordinates = {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    label: 'Sua localização',
                    automatic: true
                };

                setCoordinates(detected);
                localStorage.setItem(
                    locationStorageKey,
                    JSON.stringify(detected)
                );
                setHasSavedLocation(true);
                setLocationLoading(false);
            },
            () => {
                setCoordinates(DEFAULT_COORDINATES);
                localStorage.setItem(
                    locationStorageKey,
                    JSON.stringify(DEFAULT_COORDINATES)
                );
                setHasSavedLocation(true);
                setLocationLoading(false);
            },
            {
                enableHighAccuracy: false,
                timeout: 10000,
                maximumAge: 30 * 60 * 1000
            }
        );
    }, [locationStorageKey]);

    useEffect(() => {
        if (!hasSavedLocation) {
            requestLocation();
        }
    }, [hasSavedLocation, requestLocation]);

    const loadWeather = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        setError('');

        const params = new URLSearchParams({
            latitude: String(coordinates.latitude),
            longitude: String(coordinates.longitude),
            current: [
                'temperature_2m',
                'apparent_temperature',
                'relative_humidity_2m',
                'precipitation',
                'weather_code',
                'cloud_cover',
                'wind_speed_10m',
                'wind_gusts_10m',
                'is_day'
            ].join(','),
            hourly: [
                'temperature_2m',
                'precipitation_probability',
                'weather_code',
                'is_day',
                'wind_speed_10m'
            ].join(','),
            daily: [
                'temperature_2m_max',
                'temperature_2m_min',
                'precipitation_probability_max'
            ].join(','),
            timezone: 'auto',
            forecast_days: '2'
        });

        const cacheKey =
            'pandanet_weather_' +
            coordinates.latitude.toFixed(2) +
            '_' +
            coordinates.longitude.toFixed(2);

        try {
            const cached = localStorage.getItem(cacheKey);

            if (cached) {
                const parsed = JSON.parse(cached);

                if (
                    parsed?.savedAt &&
                    Date.now() - parsed.savedAt < 20 * 60 * 1000 &&
                    parsed?.data
                ) {
                    setWeather(parsed.data);
                    setUpdatedAt(new Date(parsed.savedAt));
                    setLoading(false);
                    return;
                }
            }

            const response = await fetch(
                'https://api.open-meteo.com/v1/forecast?' +
                params.toString(),
                {
                    headers: { Accept: 'application/json' }
                }
            );

            if (!response.ok) {
                throw new Error('Serviço meteorológico indisponível');
            }

            const data = await response.json() as WeatherData;

            if (!data?.current || !data?.hourly || !data?.daily) {
                throw new Error('Previsão incompleta');
            }

            setWeather(data);
            setUpdatedAt(new Date());
            localStorage.setItem(
                cacheKey,
                JSON.stringify({
                    savedAt: Date.now(),
                    data
                })
            );
        } catch (weatherError) {
            console.error('Falha ao carregar previsão:', weatherError);
            setError('Previsão temporariamente indisponível');
        } finally {
            setLoading(false);
        }
    }, [coordinates]);

    useEffect(() => {
        void loadWeather();

        const interval = window.setInterval(() => {
            void loadWeather(true);
        }, 20 * 60 * 1000);

        return () => window.clearInterval(interval);
    }, [loadWeather]);

    const hourlyForecast = useMemo(() => {
        if (!weather) return [];

        const currentTime = new Date(weather.current.time).getTime();
        let start = weather.hourly.time.findIndex(time =>
            new Date(time).getTime() >= currentTime
        );

        if (start < 0) start = 0;

        return weather.hourly.time
            .slice(start, start + 6)
            .map((time, index) => {
                const sourceIndex = start + index;

                return {
                    time,
                    temperature: weather.hourly.temperature_2m[sourceIndex],
                    rain: weather.hourly.precipitation_probability[sourceIndex] || 0,
                    code: weather.hourly.weather_code[sourceIndex],
                    isDay: weather.hourly.is_day[sourceIndex] === 1,
                    wind: weather.hourly.wind_speed_10m[sourceIndex] || 0
                };
            });
    }, [weather]);

    const visual = weather
        ? weatherVisual(
            weather.current.weather_code,
            weather.current.is_day === 1,
            weather.current.wind_speed_10m
        )
        : { label: 'Carregando previsão', kind: 'cloud' as const };

    if (loading && !weather) {
        return (
            <div className="min-h-[238px] animate-pulse rounded-[1.7rem] border border-white/15 bg-white/10 p-5 backdrop-blur-xl">
                <div className="h-3 w-28 rounded-full bg-white/15" />
                <div className="mt-6 h-14 w-36 rounded-2xl bg-white/15" />
                <div className="mt-7 grid grid-cols-4 gap-2">
                    {[0, 1, 2, 3].map(item => (
                        <div key={item} className="h-20 rounded-2xl bg-white/10" />
                    ))}
                </div>
            </div>
        );
    }

    if (!weather) {
        return (
            <div className="flex min-h-[238px] flex-col items-center justify-center rounded-[1.7rem] border border-white/15 bg-white/10 p-6 text-center backdrop-blur-xl">
                <WeatherScene kind="cloud" />
                <p className="mt-3 text-sm font-black text-white">{error}</p>
                <button
                    type="button"
                    onClick={() => void loadWeather()}
                    className="mt-4 rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-xs font-black text-white transition hover:bg-white/20"
                >
                    Tentar novamente
                </button>
            </div>
        );
    }

    return (
        <section className="pw-widget relative overflow-hidden rounded-[1.7rem] border border-emerald-200/80 bg-gradient-to-br from-white/95 via-emerald-50/90 to-cyan-50/90 p-4 text-slate-900 dark:border-white/15 dark:from-sky-400/20 dark:via-white/10 dark:to-indigo-500/15 dark:text-white shadow-[0_22px_50px_-30px_rgba(56,189,248,0.9)] backdrop-blur-xl">
            <style>{`
                @keyframes pw-spin { to { transform: rotate(360deg); } }
                @keyframes pw-float { 50% { transform: translateY(-5px); } }
                @keyframes pw-rain { to { transform: translate(-8px, 32px); opacity: 0; } }
                @keyframes pw-flash { 45%,55% { opacity: 1; } 50% { opacity: .2; } }
                @keyframes pw-snow { to { transform: translateY(31px) rotate(180deg); opacity: .1; } }
                @keyframes pw-wind { from { transform: translateX(-28px); opacity: 0; } 30% { opacity: 1; } to { transform: translateX(42px); opacity: 0; } }
                @keyframes pw-fog { 50% { transform: translateX(12px); opacity: .45; } }
                .pw-scene { position: relative; width: 82px; height: 68px; flex: 0 0 auto; }
                .pw-scene-small { width: 39px; height: 34px; transform: scale(.52); transform-origin: left top; margin-right: -18px; margin-bottom: -16px; }
                .pw-sun { position: absolute; width: 34px; height: 34px; right: 4px; top: 2px; border-radius: 999px; background: #fbbf24; box-shadow: 0 0 25px rgba(251,191,36,.75); animation: pw-float 3s ease-in-out infinite; }
                .pw-rays { position: absolute; inset: -9px; border: 2px dashed rgba(253,224,71,.9); border-radius: 999px; animation: pw-spin 12s linear infinite; }
                .pw-moon { position: absolute; width: 38px; height: 38px; right: 12px; top: 5px; border-radius: 999px; background: #f8fafc; box-shadow: 0 0 24px rgba(224,231,255,.65); animation: pw-float 3s ease-in-out infinite; }
                .pw-moon span { position: absolute; width: 35px; height: 35px; left: 12px; top: -5px; border-radius: 999px; background: #334155; }
                .pw-cloud { position: absolute; width: 62px; height: 25px; left: 4px; top: 29px; border-radius: 999px; background: linear-gradient(180deg,#fff,#cbd5e1); filter: drop-shadow(0 8px 8px rgba(15,23,42,.2)); animation: pw-float 3.5s ease-in-out infinite; z-index: 3; }
                .pw-cloud span { position: absolute; border-radius: 999px; background: inherit; }
                .pw-cloud-a { width: 30px; height: 30px; left: 9px; top: -14px; }
                .pw-cloud-b { width: 24px; height: 24px; left: 31px; top: -9px; }
                .pw-cloud-c { width: 20px; height: 20px; left: 3px; top: -5px; }
                .pw-rain,.pw-hail,.pw-snow { position: absolute; left: 15px; top: 49px; width: 50px; z-index: 2; }
                .pw-rain i { position: absolute; width: 3px; height: 13px; border-radius: 999px; background: #7dd3fc; transform: rotate(18deg); animation: pw-rain .8s linear infinite; }
                .pw-rain i:nth-child(2) { left: 11px; animation-delay: .22s; }
                .pw-rain i:nth-child(3) { left: 22px; animation-delay: .42s; }
                .pw-rain i:nth-child(4) { left: 34px; animation-delay: .1s; }
                .pw-rain i:nth-child(5) { left: 44px; animation-delay: .55s; }
                .pw-lightning { position: absolute; left: 34px; top: 50px; width: 12px; height: 22px; background: #fde047; clip-path: polygon(45% 0,100% 0,65% 42%,100% 42%,25% 100%,42% 55%,0 55%); z-index: 5; animation: pw-flash 1.7s infinite; }
                .pw-snow i { position: absolute; color: #e0f2fe; font-style: normal; animation: pw-snow 1.8s linear infinite; }
                .pw-snow i:nth-child(2) { left: 14px; animation-delay: .3s; }
                .pw-snow i:nth-child(3) { left: 29px; animation-delay: .8s; }
                .pw-snow i:nth-child(4) { left: 43px; animation-delay: .5s; }
                .pw-hail i { position: absolute; width: 7px; height: 7px; border-radius: 999px; background: #e0f2fe; box-shadow: inset -2px -2px 0 #93c5fd; animation: pw-snow 1.15s linear infinite; }
                .pw-hail i:nth-child(2) { left: 14px; animation-delay: .3s; }
                .pw-hail i:nth-child(3) { left: 29px; animation-delay: .6s; }
                .pw-hail i:nth-child(4) { left: 43px; animation-delay: .15s; }
                .pw-fog { position: absolute; left: 4px; top: 17px; width: 74px; }
                .pw-fog i { display: block; height: 6px; margin: 8px 0; border-radius: 999px; background: rgba(226,232,240,.85); animation: pw-fog 2.8s ease-in-out infinite; }
                .pw-fog i:nth-child(2) { width: 58px; margin-left: 12px; animation-delay: .4s; }
                .pw-wind { position: absolute; left: 6px; top: 13px; width: 68px; overflow: hidden; }
                .pw-wind i { display: block; width: 52px; height: 4px; margin: 9px 0; border-radius: 999px; background: linear-gradient(90deg,transparent,#bae6fd); animation: pw-wind 1.5s ease-in-out infinite; }
                .pw-wind i:nth-child(2) { width: 40px; animation-delay: .2s; }
                .pw-wind i:nth-child(3) { width: 62px; animation-delay: .45s; }
                .pw-wind i:nth-child(4) { width: 34px; animation-delay: .7s; }
                @media (prefers-reduced-motion: reduce) {
                    .pw-widget *, .pw-widget *::before, .pw-widget *::after { animation-duration: .001ms !important; animation-iteration-count: 1 !important; }
                }
            `}</style>

            <div className="pointer-events-none absolute -right-12 -top-16 h-40 w-40 rounded-full bg-sky-300/20 blur-3xl" />

            <div className="relative flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.2em] text-cyan-700 dark:text-sky-100">
                        <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-300 shadow-[0_0_10px_rgba(110,231,183,.9)]" />
                        Clima agora
                    </div>

                    <div className="mt-3 flex items-end gap-2">
                        <span className="text-5xl font-black leading-none tracking-tight">
                            {Math.round(weather.current.temperature_2m)}°
                        </span>
                        <span className="pb-1 text-xs font-bold text-slate-600 dark:text-sky-100">
                            Sensação {Math.round(weather.current.apparent_temperature)}°
                        </span>
                    </div>

                    <p className="mt-2 text-sm font-black">{visual.label}</p>

                    <button
                        type="button"
                        onClick={requestLocation}
                        disabled={locationLoading}
                        className="mt-1 max-w-[190px] truncate text-left text-[10px] font-semibold text-slate-600 transition hover:text-emerald-700 dark:text-slate-300 dark:hover:text-white disabled:opacity-60"
                        title="Atualizar localização"
                    >
                        {locationLoading ? 'Localizando…' : '⌖ ' + coordinates.label}
                    </button>
                </div>

                <WeatherScene kind={visual.kind} />
            </div>

            <div className="relative mt-4 grid grid-cols-3 gap-2">
                <div className="rounded-xl border border-slate-200/80 bg-white/75 px-2.5 py-2 dark:border-white/10 dark:bg-white/10 backdrop-blur-md">
                    <p className="text-[8px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-300">Máx / mín</p>
                    <p className="mt-1 text-xs font-black">
                        {Math.round(weather.daily.temperature_2m_max[0])}° · {Math.round(weather.daily.temperature_2m_min[0])}°
                    </p>
                </div>
                <div className="rounded-xl border border-slate-200/80 bg-white/75 px-2.5 py-2 dark:border-white/10 dark:bg-white/10 backdrop-blur-md">
                    <p className="text-[8px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-300">Chuva</p>
                    <p className="mt-1 text-xs font-black">
                        {weather.daily.precipitation_probability_max[0] || 0}%
                    </p>
                </div>
                <div className="rounded-xl border border-slate-200/80 bg-white/75 px-2.5 py-2 dark:border-white/10 dark:bg-white/10 backdrop-blur-md">
                    <p className="text-[8px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-300">Vento</p>
                    <p className="mt-1 text-xs font-black">
                        {Math.round(weather.current.wind_speed_10m)} km/h
                    </p>
                </div>
            </div>

            <div className="relative mt-3 overflow-x-auto pb-1">
                <div className="grid min-w-[430px] grid-cols-6 gap-2">
                    {hourlyForecast.map((hour, index) => {
                        const hourVisual = weatherVisual(
                            hour.code,
                            hour.isDay,
                            hour.wind
                        );

                        return (
                            <div
                                key={hour.time}
                                className="rounded-xl border border-slate-200/80 bg-white/70 p-2 text-center dark:border-white/10 dark:bg-slate-950/15 backdrop-blur-md transition hover:-translate-y-0.5 hover:bg-emerald-100/80 dark:hover:bg-white/15"
                            >
                                <p className="text-[9px] font-black text-slate-600 dark:text-slate-200">
                                    {index === 0
                                        ? 'Agora'
                                        : new Date(hour.time).toLocaleTimeString('pt-BR', {
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}
                                </p>
                                <div className="mx-auto mt-1 h-7 w-7">
                                    <WeatherScene kind={hourVisual.kind} compact />
                                </div>
                                <p className="mt-1 text-xs font-black">
                                    {Math.round(hour.temperature)}°
                                </p>
                                <p className="text-[8px] font-bold text-sky-200">
                                    ☂ {hour.rain}%
                                </p>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="relative mt-2 flex items-center justify-between text-[8px] font-semibold text-slate-500 dark:text-slate-400">
                <span>Próximas 6 horas</span>
                <span>
                    {updatedAt
                        ? 'Atualizado ' + updatedAt.toLocaleTimeString('pt-BR', {
                            hour: '2-digit',
                            minute: '2-digit'
                        })
                        : ''}
                </span>
            </div>
        </section>
    );
};

export default PremiumWeatherWidget;
