/* ===================================================================
   WeatherSphere Pro — script.js
   Vanilla JS weather console. Data source: Open-Meteo (no API key
   required) for geocoding, forecast and air-quality endpoints.
   =================================================================== */

(() => {
    'use strict';

    /* ============== 1. CONSTANTS & STATE ============== */

    const ENDPOINTS = {
        geocode: 'https://geocoding-api.open-meteo.com/v1/search',
        reverse: 'https://geocoding-api.open-meteo.com/v1/reverse',
        forecast: 'https://api.open-meteo.com/v1/forecast',
        airQuality: 'https://air-quality-api.open-meteo.com/v1/air-quality',
    };

    const STORAGE_KEYS = {
        recents: 'wsp_recent_searches',
        favorites: 'wsp_favorite_cities',
        unit: 'wsp_unit_pref',
        theme: 'wsp_theme_pref',
    };

    // App state lives here — single source of truth, no framework needed.
    const state = {
        unit: localStorage.getItem(STORAGE_KEYS.unit) || 'C',
        theme: localStorage.getItem(STORAGE_KEYS.theme) || 'dark',
        current: null,       // currently displayed location { name, country, lat, lon }
        weatherData: null,   // last fetched forecast payload (normalized)
        aqiData: null,
        recents: JSON.parse(localStorage.getItem(STORAGE_KEYS.recents) || '[]'),
        favorites: JSON.parse(localStorage.getItem(STORAGE_KEYS.favorites) || '[]'),
        charts: { temp: null, humidity: null, wind: null, rain: null },
    };

    /* ============== 2. DOM REFS ============== */

    const $ = (id) => document.getElementById(id);

    const dom = {
        themeToggle: $('themeToggle'),
        navSearchBtn: $('navSearchBtn'),
        navBurger: $('navBurger'),
        navLinks: document.querySelector('.nav__links'),

        heroSearchForm: $('heroSearchForm'),
        heroSearchInput: $('heroSearchInput'),
        heroLocateBtn: $('heroLocateBtn'),
        heroSuggestChips: $('heroSuggestChips'),
        heroCtaLaunch: $('heroCtaLaunch'),

        consoleLocation: $('consoleLocation'),
        consoleDate: $('consoleDate'),
        consoleIcon: $('consoleIcon'),
        consoleTemp: $('consoleTemp'),
        consoleUnitLabel: $('consoleUnitLabel'),
        consoleDesc: $('consoleDesc'),
        consoleFeels: $('consoleFeels'),
        consoleHumidity: $('consoleHumidity'),
        consoleWind: $('consoleWind'),
        consoleUV: $('consoleUV'),
        unitToggle: $('unitToggle'),

        statusBar: $('statusBar'),

        recentPills: $('recentPills'),
        favoritePills: $('favoritePills'),
        favoriteToggleBtn: $('favoriteToggleBtn'),
        favoriteToggleLabel: $('favoriteToggleLabel'),
        compareToggleBtn: $('compareToggleBtn'),

        feelsLikeValue: $('feelsLikeValue'),
        feelsLikeSub: $('feelsLikeSub'),
        humidityValue: $('humidityValue'),
        humidityBar: $('humidityBar'),
        compassNeedle: $('compassNeedle'),
        windSpeedValue: $('windSpeedValue'),
        windDirLabel: $('windDirLabel'),
        uvGaugeFill: $('uvGaugeFill'),
        uvValue: $('uvValue'),
        uvTag: $('uvTag'),
        pressureValue: $('pressureValue'),
        pressureTrend: $('pressureTrend'),
        visibilityValue: $('visibilityValue'),
        visibilityTag: $('visibilityTag'),
        rainProbValue: $('rainProbValue'),
        sunArcDot: $('sunArcDot'),
        sunriseValue: $('sunriseValue'),
        sunsetValue: $('sunsetValue'),

        alertsSection: $('alertsSection'),
        alertsText: $('alertsText'),

        aqiDialFill: $('aqiDialFill'),
        aqiValue: $('aqiValue'),
        aqiTag: $('aqiTag'),
        aqiRecommendation: $('aqiRecommendation'),
        pm25Value: $('pm25Value'),
        pm10Value: $('pm10Value'),
        o3Value: $('o3Value'),
        no2Value: $('no2Value'),
        so2Value: $('so2Value'),
        coValue: $('coValue'),

        hourlyTrack: $('hourlyTrack'),
        forecastGrid: $('forecastGrid'),
        insightsGrid: $('insightsGrid'),

        comparePanel: $('comparePanel'),
        closeCompareBtn: $('closeCompareBtn'),
        compareCityA: $('compareCityA'),
        compareCityB: $('compareCityB'),
        compareRunBtn: $('compareRunBtn'),
        compareResults: $('compareResults'),

        skyLayer: $('skyLayer'),
        starsLayer: $('starsLayer'),
        cloudsLayer: $('cloudsLayer'),
        precipCanvas: $('precipCanvas'),

        toast: $('toast'),
        footerYear: $('footerYear'),
    };

    /* ============== 3. WEATHER CODE → ICON / LABEL MAP ==============
       WMO weather codes used by Open-Meteo, mapped to a human label,
       an inline SVG icon, and a background "mood" key. */

    const WMO_MAP = {
        0: { label: 'Clear sky', icon: 'sun', mood: 'clear' },
        1: { label: 'Mainly clear', icon: 'sun-cloud', mood: 'clear' },
        2: { label: 'Partly cloudy', icon: 'sun-cloud', mood: 'cloudy' },
        3: { label: 'Overcast', icon: 'cloud', mood: 'cloudy' },
        45: { label: 'Fog', icon: 'fog', mood: 'fog' },
        48: { label: 'Rime fog', icon: 'fog', mood: 'fog' },
        51: { label: 'Light drizzle', icon: 'drizzle', mood: 'rain' },
        53: { label: 'Drizzle', icon: 'drizzle', mood: 'rain' },
        55: { label: 'Dense drizzle', icon: 'drizzle', mood: 'rain' },
        56: { label: 'Freezing drizzle', icon: 'drizzle', mood: 'rain' },
        57: { label: 'Freezing drizzle', icon: 'drizzle', mood: 'rain' },
        61: { label: 'Light rain', icon: 'rain', mood: 'rain' },
        63: { label: 'Rain', icon: 'rain', mood: 'rain' },
        65: { label: 'Heavy rain', icon: 'rain-heavy', mood: 'rain' },
        66: { label: 'Freezing rain', icon: 'rain', mood: 'rain' },
        67: { label: 'Freezing rain', icon: 'rain-heavy', mood: 'rain' },
        71: { label: 'Light snow', icon: 'snow', mood: 'snow' },
        73: { label: 'Snow', icon: 'snow', mood: 'snow' },
        75: { label: 'Heavy snow', icon: 'snow', mood: 'snow' },
        77: { label: 'Snow grains', icon: 'snow', mood: 'snow' },
        80: { label: 'Light showers', icon: 'rain', mood: 'rain' },
        81: { label: 'Showers', icon: 'rain', mood: 'rain' },
        82: { label: 'Violent showers', icon: 'rain-heavy', mood: 'storm' },
        85: { label: 'Snow showers', icon: 'snow', mood: 'snow' },
        86: { label: 'Heavy snow showers', icon: 'snow', mood: 'snow' },
        95: { label: 'Thunderstorm', icon: 'storm', mood: 'storm' },
        96: { label: 'Thunderstorm + hail', icon: 'storm', mood: 'storm' },
        99: { label: 'Severe thunderstorm', icon: 'storm', mood: 'storm' },
    };

    function getWeatherMeta(code) {
        return WMO_MAP[code] || { label: 'Unknown', icon: 'cloud', mood: 'cloudy' };
    }

    // Inline SVG icon library — kept small & stroke-based to match the console aesthetic.
    const ICONS = {
        sun: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="4.5"/><path d="M12 2.5v2.6M12 18.9v2.6M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2.5 12h2.6M18.9 12h2.6M4.2 19.8l1.8-1.8M18 6l1.8-1.8" stroke-linecap="round"/></svg>`,
        'sun-cloud': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="8.5" cy="8.5" r="3.5"/><path d="M8.5 2.5v1.6M3.6 5l1.2 1.2M2 9.7h1.6" stroke-linecap="round"/><path d="M7 20h10a4 4 0 0 0 .5-8 5.5 5.5 0 0 0-10.6 1.6A3.6 3.6 0 0 0 7 20Z" stroke-linejoin="round"/></svg>`,
        cloud: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M6 19h12a4.5 4.5 0 0 0 .4-9 6.5 6.5 0 0 0-12.6 1.8A4 4 0 0 0 6 19Z" stroke-linejoin="round"/></svg>`,
        fog: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M6 11h12a4.5 4.5 0 0 0 .4-9" stroke-linecap="round"/><path d="M3 16h18M5 20h14" stroke-linecap="round"/></svg>`,
        drizzle: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M6 14h12a4.5 4.5 0 0 0 .4-9 6.5 6.5 0 0 0-12.6 1.8A4 4 0 0 0 6 14Z" stroke-linejoin="round"/><path d="M9 18v2M13 18v2" stroke-linecap="round"/></svg>`,
        rain: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M6 13h12a4.5 4.5 0 0 0 .4-9 6.5 6.5 0 0 0-12.6 1.8A4 4 0 0 0 6 13Z" stroke-linejoin="round"/><path d="M8 17v3M12 17v3M16 17v3" stroke-linecap="round"/></svg>`,
        'rain-heavy': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M6 12h12a4.5 4.5 0 0 0 .4-9 6.5 6.5 0 0 0-12.6 1.8A4 4 0 0 0 6 12Z" stroke-linejoin="round"/><path d="M7 16l-1.5 4M12 16l-1.5 4M17 16l-1.5 4" stroke-linecap="round"/></svg>`,
        snow: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M6 13h12a4.5 4.5 0 0 0 .4-9 6.5 6.5 0 0 0-12.6 1.8A4 4 0 0 0 6 13Z" stroke-linejoin="round"/><path d="M9 18v3M9 19.5h0M12 17v4M12 19h0M15 18v3M15 19.5h0" stroke-linecap="round"/></svg>`,
        storm: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M6 12h11a4.2 4.2 0 0 0 .4-8.4A6 6 0 0 0 6 5.6 3.8 3.8 0 0 0 6 12Z" stroke-linejoin="round"/><path d="M13 14l-3 5h3l-2 4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    };

    function iconSVG(key) { return ICONS[key] || ICONS.cloud; }

    /* ============== 4. UTILITIES ============== */

    function toF(celsius) { return (celsius * 9 / 5) + 32; }

    function formatTemp(celsius) {
        const val = state.unit === 'C' ? celsius : toF(celsius);
        return Math.round(val);
    }

    function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

    function degToCompass(deg) {
        const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
        return dirs[Math.round(deg / 22.5) % 16];
    }

    function formatHour(dateStr) {
        const d = new Date(dateStr);
        return d.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });
    }

    function formatDayName(dateStr, index) {
        if (index === 0) return 'Today';
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-US', { weekday: 'short' });
    }

    function formatDateShort(dateStr) {
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
    }

    function formatClockTime(isoStr) {
        if (!isoStr) return '--:--';
        const d = new Date(isoStr);
        return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    }

    function debounce(fn, delay) {
        let timer;
        return (...args) => {
            clearTimeout(timer);
            timer = setTimeout(() => fn(...args), delay);
        };
    }

    function showToast(message, type = '') {
        dom.toast.textContent = message;
        dom.toast.className = 'toast is-visible' + (type ? ` is-${type}` : '');
        clearTimeout(showToast._t);
        showToast._t = setTimeout(() => { dom.toast.classList.remove('is-visible'); }, 3200);
    }

    function setStatus(message, isError = false) {
        dom.statusBar.textContent = message;
        dom.statusBar.classList.toggle('is-visible', !!message);
        dom.statusBar.classList.toggle('is-error', isError);
    }

    /* ============== 5. THEME ============== */

    function applyTheme(theme) {
        state.theme = theme;
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem(STORAGE_KEYS.theme, theme);
        if (window.__charts) refreshChartTheme();
    }

    dom.themeToggle.addEventListener('click', () => {
        applyTheme(state.theme === 'dark' ? 'light' : 'dark');
    });

    /* ============== 6. MOBILE NAV ============== */

    dom.navBurger.addEventListener('click', () => {
        const isOpen = dom.navLinks.classList.toggle('is-open');
        dom.navBurger.setAttribute('aria-expanded', String(isOpen));
    });

    dom.navSearchBtn.addEventListener('click', () => {
        dom.heroSearchInput.focus();
        document.querySelector('.hero__search').scrollIntoView({ behavior: 'smooth', block: 'center' });
    });

    dom.heroCtaLaunch.addEventListener('click', () => {
        document.getElementById('dashboard').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    /* ============== 7. GEOCODING & DATA FETCH ============== */

    async function geocodeCity(query) {
        const url = `${ENDPOINTS.geocode}?name=${encodeURIComponent(query)}&count=1&language=en&format=json`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('Geocoding service unavailable');
        const data = await res.json();
        if (!data.results || !data.results.length) {
            throw new Error(`No city found matching "${query}"`);
        }
        const r = data.results[0];
        return {
            name: r.name,
            country: r.country || '',
            admin1: r.admin1 || '',
            lat: r.latitude,
            lon: r.longitude,
            timezone: r.timezone || 'auto',
        };
    }

    async function reverseGeocode(lat, lon) {
        try {
            const url = `${ENDPOINTS.reverse}?latitude=${lat}&longitude=${lon}&language=en&format=json`;
            const res = await fetch(url);
            const data = await res.json();
            const r = data.results && data.results[0];
            return r ? { name: r.name, country: r.country || '' } : { name: 'Your location', country: '' };
        } catch {
            return { name: 'Your location', country: '' };
        }
    }

    async function fetchForecast(lat, lon, timezone) {
        const params = new URLSearchParams({
            latitude: lat,
            longitude: lon,
            timezone: timezone || 'auto',
            current: [
                'temperature_2m', 'relative_humidity_2m', 'apparent_temperature',
                'weather_code', 'wind_speed_10m', 'wind_direction_10m',
                'pressure_msl', 'visibility', 'is_day', 'precipitation', 'uv_index'
            ].join(','),
            hourly: [
                'temperature_2m', 'relative_humidity_2m', 'weather_code',
                'precipitation_probability', 'wind_speed_10m', 'uv_index'
            ].join(','),
            daily: [
                'weather_code', 'temperature_2m_max', 'temperature_2m_min',
                'sunrise', 'sunset', 'precipitation_probability_max', 'uv_index_max', 'wind_speed_10m_max'
            ].join(','),
            forecast_days: 7,
        });
        const res = await fetch(`${ENDPOINTS.forecast}?${params.toString()}`);
        if (!res.ok) throw new Error('Forecast service unavailable');
        return res.json();
    }

    async function fetchAirQuality(lat, lon) {
        const params = new URLSearchParams({
            latitude: lat,
            longitude: lon,
            current: ['pm2_5', 'pm10', 'ozone', 'nitrogen_dioxide', 'sulphur_dioxide', 'carbon_monoxide', 'us_aqi'].join(','),
        });
        const res = await fetch(`${ENDPOINTS.airQuality}?${params.toString()}`);
        if (!res.ok) throw new Error('Air quality service unavailable');
        return res.json();
    }

    /* ============== 8. MAIN ORCHESTRATION ============== */

    /* ============== 8b. SKELETON LOADING STATES ==============
       Applied only on the very first fetch (cold load), since later
       searches already have content on screen and a full skeleton
       flash would feel like a regression rather than a loading cue. */

    function setSkeletonLoading(isLoading) {
        const targets = document.querySelectorAll('.bento-card, .chart-card');
        targets.forEach(el => el.classList.toggle('is-loading', isLoading));
    }

    async function loadLocationWeather(location) {
        try {
            setStatus(`Fetching live conditions for ${location.name}…`);
            toggleConsoleLoading(true);
            if (!state.weatherData) setSkeletonLoading(true); // only on cold load

            const [forecast, aqi] = await Promise.all([
                fetchForecast(location.lat, location.lon, location.timezone),
                fetchAirQuality(location.lat, location.lon).catch(() => null),
            ]);

            state.current = location;
            state.weatherData = forecast;
            state.aqiData = aqi;

            renderAll();
            addToRecents(location);
            updateFavoriteButtonState();
            setStatus(`Last updated ${new Date().toLocaleTimeString()} · Data via Open-Meteo`);
        } catch (err) {
            console.error(err);
            setStatus(err.message || 'Something went wrong fetching weather data.', true);
            showToast(err.message || 'Could not load weather data', 'error');
        } finally {
            toggleConsoleLoading(false);
            setSkeletonLoading(false);
        }
    }

    async function searchAndLoad(query) {
        if (!query || !query.trim()) return;
        try {
            setStatus(`Looking up "${query}"…`);
            const location = await geocodeCity(query.trim());
            await loadLocationWeather(location);
        } catch (err) {
            setStatus(err.message, true);
            showToast(err.message, 'error');
        }
    }

    function toggleConsoleLoading(isLoading) {
        if (isLoading) {
            dom.consoleIcon.innerHTML = '<div class="loader-ring"></div>';
        }
    }

    /* ============== 9. GEOLOCATION ============== */

    function detectGeolocation() {
        if (!navigator.geolocation) {
            searchAndLoad('Mumbai');
            setStatus('Geolocation not supported — showing Mumbai by default.');
            return;
        }
        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                const { latitude, longitude } = pos.coords;
                const place = await reverseGeocode(latitude, longitude);
                await loadLocationWeather({
                    name: place.name, country: place.country,
                    lat: latitude, lon: longitude, timezone: 'auto',
                });
            },
            () => {
                searchAndLoad('Mumbai');
                setStatus('Location access denied — showing Mumbai by default.');
            },
            { timeout: 8000 }
        );
    }

    dom.heroLocateBtn.addEventListener('click', () => {
        setStatus('Detecting your location…');
        detectGeolocation();
    });

    /* ============== 10. RENDERING ============== */

    function renderAll() {
        if (!state.weatherData) return;
        renderConsoleCard();
        renderHighlights();
        renderAlerts();
        renderAQI();
        renderHourly();

        // Chart.js is bundled locally (vendor/chart.umd.js), so this should
        // always succeed. The try/catch stays only as a safety net — e.g. if
        // the vendor file is missing or corrupted — so a chart failure can't
        // silently take down the forecast grid or insights below it.
        try {
            renderCharts();
        } catch (err) {
            console.error('Chart rendering failed:', err);
            showChartFallbackMessage();
        }

        renderForecastGrid();
        renderInsights();
        updateBackgroundMood();
    }

    function showChartFallbackMessage() {
        document.querySelectorAll('.chart-card').forEach(card => {
            card.classList.remove('is-loading');
            const canvas = card.querySelector('canvas');
            if (canvas && !card.querySelector('.chart-card__error')) {
                const msg = document.createElement('p');
                msg.className = 'chart-card__error';
                msg.textContent = 'Charts could not render — vendor/chart.umd.js may be missing or the file failed to load. Check the browser console for details.';
                canvas.style.display = 'none';
                card.appendChild(msg);
            }
        });
    }

    function renderConsoleCard() {
        const { current: c, weatherData: w } = state;
        const meta = getWeatherMeta(w.current.weather_code);

        dom.consoleLocation.textContent = `${c.name}${c.country ? ', ' + c.country : ''}`;
        dom.consoleDate.textContent = new Date().toLocaleDateString('en-US', {
            weekday: 'long', day: 'numeric', month: 'long',
        });
        dom.consoleIcon.innerHTML = iconSVG(meta.icon);
        dom.consoleIcon.style.color = 'var(--accent-amber)';

        dom.consoleTemp.textContent = formatTemp(w.current.temperature_2m);
        dom.consoleUnitLabel.textContent = state.unit;
        dom.consoleDesc.textContent = meta.label;
        dom.consoleFeels.innerHTML = `Feels like <span>${formatTemp(w.current.apparent_temperature)}°</span>`;
        dom.consoleHumidity.textContent = `${Math.round(w.current.relative_humidity_2m)}%`;
        dom.consoleWind.textContent = `${Math.round(w.current.wind_speed_10m)} km/h`;
        dom.consoleUV.textContent = w.current.uv_index != null ? Math.round(w.current.uv_index) : '--';

        dom.unitToggle.textContent = state.unit === 'C' ? 'Switch to °F' : 'Switch to °C';
    }

    function renderHighlights() {
        const cur = state.weatherData.current;
        const daily = state.weatherData.daily;

        // Feels like
        dom.feelsLikeValue.textContent = `${formatTemp(cur.apparent_temperature)}°`;
        const diff = Math.round(cur.apparent_temperature - cur.temperature_2m);
        dom.feelsLikeSub.textContent = diff === 0
            ? 'Matches actual temperature'
            : diff > 0 ? `Feels ${diff}° warmer than actual` : `Feels ${Math.abs(diff)}° cooler than actual`;

        // Humidity
        const hum = Math.round(cur.relative_humidity_2m);
        dom.humidityValue.textContent = `${hum}%`;
        dom.humidityBar.style.width = `${hum}%`;

        // Wind
        dom.windSpeedValue.textContent = Math.round(cur.wind_speed_10m);
        dom.windDirLabel.textContent = `${degToCompass(cur.wind_direction_10m)} · ${Math.round(cur.wind_direction_10m)}°`;
        dom.compassNeedle.style.transform = `translate(-50%, -100%) rotate(${cur.wind_direction_10m}deg)`;

        // UV gauge (0-11+ scale mapped to semicircle, dasharray 157)
        const uv = cur.uv_index != null ? cur.uv_index : 0;
        const uvPct = clamp(uv / 11, 0, 1);
        dom.uvGaugeFill.style.strokeDashoffset = String(157 - (157 * uvPct));
        dom.uvValue.textContent = Math.round(uv);
        let uvTag = 'Low', uvColor = 'var(--accent-good)';
        if (uv >= 8) { uvTag = 'Very High'; uvColor = 'var(--accent-bad)'; }
        else if (uv >= 6) { uvTag = 'High'; uvColor = 'var(--accent-warn)'; }
        else if (uv >= 3) { uvTag = 'Moderate'; uvColor = 'var(--accent-amber)'; }
        dom.uvTag.textContent = uvTag;
        dom.uvGaugeFill.style.stroke = uvColor;

        // Pressure
        dom.pressureValue.textContent = `${Math.round(cur.pressure_msl)} hPa`;
        dom.pressureTrend.textContent = cur.pressure_msl > 1013 ? 'High pressure system' : 'Low pressure system';

        // Visibility (meters -> km)
        const visKm = (cur.visibility / 1000).toFixed(1);
        dom.visibilityValue.textContent = `${visKm} km`;
        dom.visibilityTag.textContent = visKm > 8 ? 'Excellent visibility' : visKm > 4 ? 'Good visibility' : 'Reduced visibility';

        // Rain probability (next hour, from hourly array — find current hour index)
        const nowIdx = findCurrentHourIndex();
        const rainProb = state.weatherData.hourly.precipitation_probability[nowIdx] ?? 0;
        dom.rainProbValue.textContent = `${rainProb}%`;

        // Sunrise / Sunset (today)
        const sunrise = daily.sunrise[0];
        const sunset = daily.sunset[0];
        dom.sunriseValue.textContent = formatClockTime(sunrise);
        dom.sunsetValue.textContent = formatClockTime(sunset);
        positionSunDot(sunrise, sunset);
    }

    function positionSunDot(sunriseISO, sunsetISO) {
        const now = new Date();
        const sunrise = new Date(sunriseISO);
        const sunset = new Date(sunsetISO);
        const total = sunset - sunrise;
        let progress = clamp((now - sunrise) / total, 0, 1);
        if (now < sunrise) progress = 0;
        if (now > sunset) progress = 1;

        // Arc path: M10 80 A70 70 0 0 1 150 80  -> approximate position along semicircle
        const angle = Math.PI * (1 - progress); // PI -> 0
        const cx = 80, cy = 80, r = 70;
        const x = cx - r * Math.cos(angle);
        const y = cy - r * Math.sin(angle);
        dom.sunArcDot.setAttribute('cx', x.toFixed(1));
        dom.sunArcDot.setAttribute('cy', y.toFixed(1));
    }

    function findCurrentHourIndex() {
        const times = state.weatherData.hourly.time;
        const now = new Date();
        let idx = times.findIndex(t => new Date(t) >= now);
        return idx === -1 ? 0 : idx;
    }

    function renderAlerts() {
        const cur = state.weatherData.current;
        const daily = state.weatherData.daily;
        const meta = getWeatherMeta(cur.weather_code);
        const messages = [];

        if (meta.mood === 'storm') messages.push('Thunderstorm activity expected — secure loose outdoor items.');
        if (cur.uv_index >= 8) messages.push('Extreme UV levels — limit direct sun exposure.');
        if (cur.wind_speed_10m >= 40) messages.push('High wind speeds — exercise caution outdoors.');
        if (daily.precipitation_probability_max[0] >= 70) messages.push('High chance of heavy rainfall today.');

        if (messages.length) {
            dom.alertsSection.hidden = false;
            dom.alertsText.textContent = messages.join(' ');
        } else {
            dom.alertsSection.hidden = true;
        }
    }

    function aqiLabel(aqi) {
        if (aqi == null) return { tag: '—', color: 'var(--accent-good)', advice: 'Air quality data unavailable for this location.' };
        if (aqi <= 50) return { tag: 'Good', color: 'var(--accent-good)', advice: 'Air quality is satisfactory. Great day for outdoor activity.' };
        if (aqi <= 100) return { tag: 'Moderate', color: 'var(--accent-warn)', advice: 'Acceptable air quality. Sensitive groups should limit prolonged exertion outdoors.' };
        if (aqi <= 150) return { tag: 'Unhealthy (SG)', color: 'var(--accent-amber)', advice: 'Sensitive groups (children, elderly, asthma) should reduce outdoor exertion.' };
        if (aqi <= 200) return { tag: 'Unhealthy', color: 'var(--accent-bad)', advice: 'Everyone may experience health effects. Consider wearing a mask outdoors.' };
        return { tag: 'Hazardous', color: 'var(--accent-bad)', advice: 'Health alert: avoid outdoor activity and keep windows closed.' };
    }

    function renderAQI() {
        if (!state.aqiData || !state.aqiData.current) {
            dom.aqiValue.textContent = '--';
            dom.aqiTag.textContent = 'Unavailable';
            dom.aqiRecommendation.textContent = 'Air quality data unavailable for this location.';
            return;
        }
        const c = state.aqiData.current;
        const aqi = Math.round(c.us_aqi ?? 0);
        const { tag, color, advice } = aqiLabel(aqi);

        const pct = clamp(aqi / 300, 0, 1);
        dom.aqiDialFill.style.strokeDashoffset = String(364.4 - (364.4 * pct));
        dom.aqiDialFill.style.stroke = color;
        dom.aqiValue.textContent = aqi;
        dom.aqiTag.textContent = tag;
        dom.aqiRecommendation.textContent = advice;

        dom.pm25Value.textContent = c.pm2_5 != null ? `${Math.round(c.pm2_5)} µg/m³` : '--';
        dom.pm10Value.textContent = c.pm10 != null ? `${Math.round(c.pm10)} µg/m³` : '--';
        dom.o3Value.textContent = c.ozone != null ? `${Math.round(c.ozone)} µg/m³` : '--';
        dom.no2Value.textContent = c.nitrogen_dioxide != null ? `${Math.round(c.nitrogen_dioxide)} µg/m³` : '--';
        dom.so2Value.textContent = c.sulphur_dioxide != null ? `${Math.round(c.sulphur_dioxide)} µg/m³` : '--';
        dom.coValue.textContent = c.carbon_monoxide != null ? `${Math.round(c.carbon_monoxide)} µg/m³` : '--';
    }

    function renderHourly() {
        const { time, temperature_2m, weather_code, precipitation_probability } = state.weatherData.hourly;
        const startIdx = findCurrentHourIndex();
        const slice = 24;

        dom.hourlyTrack.innerHTML = '';
        for (let i = startIdx; i < startIdx + slice && i < time.length; i++) {
            const meta = getWeatherMeta(weather_code[i]);
            const card = document.createElement('div');
            card.className = 'hour-card';
            card.innerHTML = `
        <span class="hour-card__time">${i === startIdx ? 'Now' : formatHour(time[i])}</span>
        <span class="hour-card__icon" style="color: var(--accent-amber)">${iconSVG(meta.icon)}</span>
        <span class="hour-card__temp">${formatTemp(temperature_2m[i])}°</span>
        <span class="hour-card__rain">💧 ${precipitation_probability[i] ?? 0}%</span>
      `;
            dom.hourlyTrack.appendChild(card);
        }
    }

    function renderForecastGrid() {
        const { time, weather_code, temperature_2m_max, temperature_2m_min, precipitation_probability_max } = state.weatherData.daily;
        dom.forecastGrid.innerHTML = '';
        time.forEach((dateStr, i) => {
            const meta = getWeatherMeta(weather_code[i]);
            const card = document.createElement('div');
            card.className = 'day-card';
            card.innerHTML = `
        <span class="day-card__name">${formatDayName(dateStr, i)}</span>
        <span class="day-card__date">${formatDateShort(dateStr)}</span>
        <span class="day-card__icon" style="color: var(--accent-amber)">${iconSVG(meta.icon)}</span>
        <span class="day-card__temps">
          <span class="day-card__max">${formatTemp(temperature_2m_max[i])}°</span>
          <span class="day-card__min">${formatTemp(temperature_2m_min[i])}°</span>
        </span>
        <span class="day-card__rain">💧 ${precipitation_probability_max[i] ?? 0}%</span>
      `;
            dom.forecastGrid.appendChild(card);
        });
    }

    /* ============== 10b. WEATHER INSIGHTS ==============
       Generates a small set of plain-language recommendations from the
       same data already on the page — no extra API calls needed. */

    function renderInsights() {
        const cur = state.weatherData.current;
        const daily = state.weatherData.daily;
        const aqi = state.aqiData?.current?.us_aqi;
        const insights = [];

        // Best time to go outside — pick the lowest-rain, mildest hour in next 12h
        const startIdx = findCurrentHourIndex();
        const hourly = state.weatherData.hourly;
        let bestIdx = startIdx, bestScore = -Infinity;
        for (let i = startIdx; i < startIdx + 12 && i < hourly.time.length; i++) {
            const rain = hourly.precipitation_probability[i] ?? 0;
            const temp = hourly.temperature_2m[i];
            const score = (100 - rain) - Math.abs(temp - 23); // closer to 23°C and drier = better
            if (score > bestScore) { bestScore = score; bestIdx = i; }
        }
        insights.push({
            icon: '🕒', tone: 'good', title: 'Best time to go outside',
            text: `Around ${formatHour(hourly.time[bestIdx])}, conditions look most comfortable — ${Math.round(hourly.temperature_2m[bestIdx])}° with ${hourly.precipitation_probability[bestIdx] ?? 0}% rain chance.`,
        });

        // UV warning
        const uv = cur.uv_index ?? 0;
        if (uv >= 6) {
            insights.push({
                icon: '☀️', tone: uv >= 8 ? 'danger' : 'warn', title: 'UV protection recommended',
                text: `UV index is ${Math.round(uv)} right now. Wear sunscreen and avoid peak midday sun if you're outdoors for long.`,
            });
        } else {
            insights.push({
                icon: '☀️', tone: 'good', title: 'UV levels are low',
                text: `UV index is only ${Math.round(uv)} — minimal sun protection needed today.`,
            });
        }

        // Rain warning
        const maxRain = daily.precipitation_probability_max[0] ?? 0;
        if (maxRain >= 50) {
            insights.push({
                icon: '🌧️', tone: 'warn', title: 'Rain likely today',
                text: `There's a ${maxRain}% chance of rain today — keep an umbrella within reach.`,
            });
        } else {
            insights.push({
                icon: '🌤️', tone: 'good', title: 'Low rain risk',
                text: `Only a ${maxRain}% chance of rain today — should stay mostly dry.`,
            });
        }

        // Wind alert
        const wind = cur.wind_speed_10m ?? 0;
        if (wind >= 30) {
            insights.push({
                icon: '💨', tone: 'warn', title: 'Strong winds expected',
                text: `Wind speeds are around ${Math.round(wind)} km/h. Secure loose outdoor items and ride bikes/two-wheelers with care.`,
            });
        }

        // Air quality suggestion
        if (aqi != null) {
            const { tag, advice } = aqiLabel(Math.round(aqi));
            insights.push({
                icon: '🫧', tone: aqi > 150 ? 'danger' : aqi > 100 ? 'warn' : 'good',
                title: `Air quality: ${tag}`, text: advice,
            });
        }

        dom.insightsGrid.innerHTML = insights.map(i => `
      <div class="insight-card insight-card--${i.tone}">
        <span class="insight-card__icon">${i.icon}</span>
        <div>
          <p class="insight-card__title">${i.title}</p>
          <p class="insight-card__text">${i.text}</p>
        </div>
      </div>
    `).join('');
    }

    /* ============== 11. CHARTS (Chart.js) ============== */

    function chartTheme() {
        const isDark = state.theme === 'dark';
        return {
            grid: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.07)',
            text: isDark ? '#9aa6bd' : '#4b5670',
            sky: '#38bdf8',
            violet: '#a78bfa',
            amber: '#fb923c',
        };
    }

    function baseChartOptions(yLabel) {
        const t = chartTheme();
        return {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#111827', titleColor: '#fff', bodyColor: '#e5e7eb',
                    padding: 10, cornerRadius: 8, displayColors: false,
                },
            },
            scales: {
                x: { grid: { color: t.grid, display: false }, ticks: { color: t.text, font: { size: 11 } } },
                y: { grid: { color: t.grid }, ticks: { color: t.text, font: { size: 11 } }, title: { display: false } },
            },
        };
    }

    function renderCharts() {
        const t = chartTheme();
        const startIdx = findCurrentHourIndex();
        const hourly = state.weatherData.hourly;
        const labels = hourly.time.slice(startIdx, startIdx + 12).map(formatHour);
        const temps = hourly.temperature_2m.slice(startIdx, startIdx + 12).map(v => state.unit === 'C' ? v : toF(v));
        const humidity = hourly.relative_humidity_2m.slice(startIdx, startIdx + 12);
        const wind = hourly.wind_speed_10m.slice(startIdx, startIdx + 12);
        const rain = hourly.precipitation_probability.slice(startIdx, startIdx + 12);

        destroyCharts();

        state.charts.temp = new Chart($('tempChart'), {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    data: temps, borderColor: t.sky, backgroundColor: 'rgba(56,189,248,0.15)',
                    fill: true, tension: 0.4, pointRadius: 0, borderWidth: 2.5,
                }],
            },
            options: baseChartOptions('°' + state.unit),
        });

        state.charts.humidity = new Chart($('humidityChart'), {
            type: 'bar',
            data: {
                labels,
                datasets: [{ data: humidity, backgroundColor: 'rgba(167,139,250,0.55)', borderRadius: 6, maxBarThickness: 22 }],
            },
            options: baseChartOptions('%'),
        });

        state.charts.wind = new Chart($('windChart'), {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    data: wind, borderColor: t.amber, backgroundColor: 'rgba(251,146,60,0.12)',
                    fill: true, tension: 0.4, pointRadius: 0, borderWidth: 2.5,
                }],
            },
            options: baseChartOptions('km/h'),
        });

        state.charts.rain = new Chart($('rainChart'), {
            type: 'bar',
            data: {
                labels,
                datasets: [{ data: rain, backgroundColor: 'rgba(56,189,248,0.5)', borderRadius: 6, maxBarThickness: 22 }],
            },
            options: baseChartOptions('%'),
        });

        window.__charts = true;
    }

    function destroyCharts() {
        Object.values(state.charts).forEach(c => c && c.destroy());
    }

    function refreshChartTheme() {
        if (state.weatherData) renderCharts();
    }

    /* ============== 12. DYNAMIC BACKGROUND ============== */

    function updateBackgroundMood() {
        const cur = state.weatherData.current;
        const meta = getWeatherMeta(cur.weather_code);
        document.body.setAttribute('data-mood', meta.mood);
        document.body.setAttribute('data-daytime', cur.is_day ? 'day' : 'night');
        renderPrecipitation(meta.mood);
    }

    let precipAnimId = null;
    function renderPrecipitation(mood) {
        const canvas = dom.precipCanvas;
        const ctx = canvas.getContext('2d');
        if (precipAnimId) cancelAnimationFrame(precipAnimId);

        function resize() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        }
        resize();

        if (mood !== 'rain' && mood !== 'storm' && mood !== 'snow') {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            return;
        }

        const isSnow = mood === 'snow';
        const count = isSnow ? 70 : 110;
        const drops = Array.from({ length: count }, () => ({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            len: isSnow ? Math.random() * 3 + 2 : Math.random() * 16 + 10,
            speed: isSnow ? Math.random() * 1 + 0.5 : Math.random() * 6 + 8,
            drift: isSnow ? Math.random() * 0.6 - 0.3 : 0,
        }));

        function tick() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.strokeStyle = isSnow ? 'rgba(255,255,255,0.7)' : 'rgba(180,210,255,0.45)';
            ctx.lineWidth = isSnow ? 0 : 1.4;
            drops.forEach(d => {
                if (isSnow) {
                    ctx.beginPath();
                    ctx.arc(d.x, d.y, d.len / 2, 0, Math.PI * 2);
                    ctx.fillStyle = 'rgba(255,255,255,0.7)';
                    ctx.fill();
                } else {
                    ctx.beginPath();
                    ctx.moveTo(d.x, d.y);
                    ctx.lineTo(d.x, d.y + d.len);
                    ctx.stroke();
                }
                d.y += d.speed;
                d.x += d.drift;
                if (d.y > canvas.height) { d.y = -10; d.x = Math.random() * canvas.width; }
            });
            precipAnimId = requestAnimationFrame(tick);
        }
        tick();
    }

    window.addEventListener('resize', debounce(() => {
        if (state.weatherData) renderPrecipitation(getWeatherMeta(state.weatherData.current.weather_code).mood);
    }, 250));

    function spawnClouds() {
        dom.cloudsLayer.innerHTML = '';
        const count = 5;
        for (let i = 0; i < count; i++) {
            const puff = document.createElement('div');
            puff.className = 'cloud-puff';
            const size = Math.random() * 140 + 80;
            puff.style.width = `${size}px`;
            puff.style.height = `${size * 0.5}px`;
            puff.style.top = `${Math.random() * 60}%`;
            puff.style.animationDuration = `${Math.random() * 40 + 50}s`;
            puff.style.animationDelay = `-${Math.random() * 40}s`;
            dom.cloudsLayer.appendChild(puff);
        }
    }

    function spawnStars() {
        dom.starsLayer.innerHTML = '';
        const count = 80;
        for (let i = 0; i < count; i++) {
            const star = document.createElement('span');
            star.style.left = `${Math.random() * 100}%`;
            star.style.top = `${Math.random() * 70}%`;
            star.style.animationDelay = `${Math.random() * 3.5}s`;
            dom.starsLayer.appendChild(star);
        }
    }

    /* ============== 13. RECENTS & FAVORITES ============== */

    function persistRecents() { localStorage.setItem(STORAGE_KEYS.recents, JSON.stringify(state.recents)); }
    function persistFavorites() { localStorage.setItem(STORAGE_KEYS.favorites, JSON.stringify(state.favorites)); }

    function locationKey(loc) { return `${loc.name}|${loc.country}`; }

    function addToRecents(loc) {
        state.recents = state.recents.filter(r => locationKey(r) !== locationKey(loc));
        state.recents.unshift({ name: loc.name, country: loc.country, lat: loc.lat, lon: loc.lon, timezone: loc.timezone });
        state.recents = state.recents.slice(0, 6);
        persistRecents();
        renderRecentsAndFavorites();
    }

    function toggleFavorite() {
        if (!state.current) return;
        const key = locationKey(state.current);
        const idx = state.favorites.findIndex(f => locationKey(f) === key);
        if (idx === -1) {
            state.favorites.unshift({ ...state.current });
            showToast(`${state.current.name} saved to favorites`, 'success');
        } else {
            state.favorites.splice(idx, 1);
            showToast(`${state.current.name} removed from favorites`);
        }
        persistFavorites();
        renderRecentsAndFavorites();
        updateFavoriteButtonState();
    }

    function updateFavoriteButtonState() {
        if (!state.current) return;
        const isFav = state.favorites.some(f => locationKey(f) === locationKey(state.current));
        dom.favoriteToggleBtn.classList.toggle('is-active', isFav);
        dom.favoriteToggleLabel.textContent = isFav ? 'Saved' : 'Save city';
    }

    function renderRecentsAndFavorites() {
        dom.recentPills.innerHTML = state.recents.length
            ? state.recents.map(r => pillHTML(r)).join('')
            : '<span class="toolbar__empty">No recent searches yet</span>';

        dom.favoritePills.innerHTML = state.favorites.length
            ? state.favorites.map(r => pillHTML(r, true)).join('')
            : '<span class="toolbar__empty">Star a city to save it</span>';

        document.querySelectorAll('.pill[data-lat]').forEach(btn => {
            btn.addEventListener('click', () => {
                loadLocationWeather({
                    name: btn.dataset.name, country: btn.dataset.country,
                    lat: parseFloat(btn.dataset.lat), lon: parseFloat(btn.dataset.lon), timezone: 'auto',
                });
            });
        });
    }

    function pillHTML(loc, isFav) {
        return `<button class="pill${isFav ? ' pill--fav' : ''}" data-name="${loc.name}" data-country="${loc.country}" data-lat="${loc.lat}" data-lon="${loc.lon}">
      ${isFav ? '★ ' : ''}${loc.name}
    </button>`;
    }

    dom.favoriteToggleBtn.addEventListener('click', toggleFavorite);

    /* ============== 14. UNIT TOGGLE ============== */

    function toggleUnit() {
        state.unit = state.unit === 'C' ? 'F' : 'C';
        localStorage.setItem(STORAGE_KEYS.unit, state.unit);
        if (state.weatherData) renderAll();
    }
    dom.unitToggle.addEventListener('click', toggleUnit);

    /* ============== 15. SEARCH HANDLERS ============== */

    dom.heroSearchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        searchAndLoad(dom.heroSearchInput.value);
        dom.heroSearchInput.blur();
    });

    dom.heroSuggestChips.addEventListener('click', (e) => {
        const btn = e.target.closest('.chip');
        if (!btn) return;
        dom.heroSearchInput.value = btn.dataset.city;
        searchAndLoad(btn.dataset.city);
    });

    /* ============== 16. COMPARE CITIES ============== */

    dom.compareToggleBtn.addEventListener('click', () => {
        dom.comparePanel.hidden = !dom.comparePanel.hidden;
        if (!dom.comparePanel.hidden) dom.comparePanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    dom.closeCompareBtn.addEventListener('click', () => { dom.comparePanel.hidden = true; });

    async function runComparison() {
        const cityA = dom.compareCityA.value.trim();
        const cityB = dom.compareCityB.value.trim();
        if (!cityA || !cityB) {
            showToast('Enter both city names to compare', 'error');
            return;
        }
        try {
            dom.compareRunBtn.textContent = 'Comparing…';
            const [locA, locB] = await Promise.all([geocodeCity(cityA), geocodeCity(cityB)]);
            const [wA, wB] = await Promise.all([
                fetchForecast(locA.lat, locA.lon, locA.timezone),
                fetchForecast(locB.lat, locB.lon, locB.timezone),
            ]);
            renderComparison(locA, wA, locB, wB);
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            dom.compareRunBtn.textContent = 'Compare';
        }
    }
    dom.compareRunBtn.addEventListener('click', runComparison);

    function renderComparison(locA, wA, locB, wB) {
        const cA = wA.current, cB = wB.current;
        const rows = [
            ['Temperature', formatTemp(cA.temperature_2m) + '°', formatTemp(cB.temperature_2m) + '°', cA.temperature_2m, cB.temperature_2m, 'higher'],
            ['Feels Like', formatTemp(cA.apparent_temperature) + '°', formatTemp(cB.apparent_temperature) + '°'],
            ['Humidity', Math.round(cA.relative_humidity_2m) + '%', Math.round(cB.relative_humidity_2m) + '%', cA.relative_humidity_2m, cB.relative_humidity_2m, 'lower'],
            ['Wind Speed', Math.round(cA.wind_speed_10m) + ' km/h', Math.round(cB.wind_speed_10m) + ' km/h', cA.wind_speed_10m, cB.wind_speed_10m, 'lower'],
            ['Pressure', Math.round(cA.pressure_msl) + ' hPa', Math.round(cB.pressure_msl) + ' hPa'],
            ['UV Index', Math.round(cA.uv_index || 0), Math.round(cB.uv_index || 0), cA.uv_index, cB.uv_index, 'lower'],
            ['Condition', getWeatherMeta(cA.weather_code).label, getWeatherMeta(cB.weather_code).label],
        ];

        function betterClass(valA, valB, pref, side) {
            if (valA == null || valB == null || pref == null) return '';
            const aWins = pref === 'higher' ? valA > valB : valA < valB;
            const bWins = pref === 'higher' ? valB > valA : valB < valA;
            if (side === 'a' && aWins) return 'is-better';
            if (side === 'b' && bWins) return 'is-better';
            return '';
        }

        dom.compareResults.innerHTML = `
      <div class="compare-col">
        <span class="compare-col__city">${locA.name}</span>
        ${rows.map(r => `<div class="compare-metric"><span>${r[0]}</span><strong class="${betterClass(r[3], r[4], r[5], 'a')}">${r[1]}</strong></div>`).join('')}
      </div>
      <div class="compare-divider"></div>
      <div class="compare-col">
        <span class="compare-col__city">${locB.name}</span>
        ${rows.map(r => `<div class="compare-metric"><span>${r[0]}</span><strong class="${betterClass(r[3], r[4], r[5], 'b')}">${r[2]}</strong></div>`).join('')}
      </div>
    `;
        dom.compareResults.classList.add('is-active');
    }

    /* ============== 17. INIT ============== */

    function init() {
        // Explicit, early check: if Chart.js didn't load (e.g. vendor file
        // missing or moved), say so clearly in the console immediately,
        // rather than letting it surface later as a vague render error.
        if (typeof Chart === 'undefined') {
            console.error(
                'Chart.js was not found on window. Check that vendor/chart.umd.js ' +
                'exists in the project folder and that index.html loads it before script.js.'
            );
        }

        applyTheme(state.theme);
        dom.footerYear.textContent = new Date().getFullYear();
        spawnStars();
        spawnClouds();
        renderRecentsAndFavorites();
        detectGeolocation();
    }

    document.addEventListener('DOMContentLoaded', init);
})();