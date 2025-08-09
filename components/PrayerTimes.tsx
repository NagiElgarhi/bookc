import React, { useState, useEffect, useRef } from 'react';
import { XIcon, PrayerTimeIcon, HomeIcon } from './icons';
import LoadingSpinner from './LoadingSpinner';

interface Timings {
    Fajr: string;
    Sunrise: string;
    Dhuhr: string;
    Asr: string;
    Maghrib: string;
    Isha: string;
}

interface PrayerTimesProps {
    onGoHome: () => void;
}

const PrayerTimes: React.FC<PrayerTimesProps> = ({ onGoHome }) => {
    const [timings, setTimings] = useState<Timings | null>(null);
    const [location, setLocation] = useState<string | null>(null);
    const [date, setDate] = useState<string>('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [enabledAlerts, setEnabledAlerts] = useState<Record<string, boolean>>(
        () => JSON.parse(localStorage.getItem('prayerAlerts') || '{}')
    );
    const audioRef = useRef<HTMLAudioElement>(null);
    const timeoutRef = useRef<number | null>(null);
    const goldenGradient = 'linear-gradient(to bottom right, #FBBF24, #262626)';

    useEffect(() => {
        localStorage.setItem('prayerAlerts', JSON.stringify(enabledAlerts));
    }, [enabledAlerts]);

    const handleToggleAlert = (prayerKey: string) => {
        setEnabledAlerts(prev => ({
            ...prev,
            [prayerKey]: !prev[prayerKey]
        }));
    };

    useEffect(() => {
        // Fetch data only if it hasn't been fetched yet
        if (!timings) {
            setIsLoading(true);
            setError(null);
            
            const fetchLocationAndTimings = async () => {
                try {
                    const locRes = await fetch('https://ipapi.co/json/');
                    if (!locRes.ok) throw new Error('فشل تحديد الموقع.');
                    const locData = await locRes.json();
                    const { city, country_name } = locData;
                    setLocation(`${city}, ${country_name}`);
                    
                    const prayerRes = await fetch(`https://api.aladhan.com/v1/timingsByCity?city=${city}&country=${country_name}&method=2`);
                    if (!prayerRes.ok) throw new Error('فشل جلب مواقيت الصلاة.');
                    const prayerData = await prayerRes.json();
                    
                    if (prayerData.code === 200) {
                        setTimings(prayerData.data.timings);
                        setDate(prayerData.data.date.readable);
                    } else {
                        throw new Error(prayerData.data.error || 'خطأ غير معروف في جلب المواقيت.');
                    }
                } catch (err) {
                    setError(err instanceof Error ? err.message : 'حدث خطأ غير متوقع.');
                } finally {
                    setIsLoading(false);
                }
            };
            fetchLocationAndTimings();
        }
    }, [timings]); // Depend on `timings` to prevent re-fetching

    useEffect(() => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }

        if (Object.values(enabledAlerts).some(v => v) && timings) {
            const now = new Date();
            const prayerTimes = Object.entries(timings)
                .filter(([name]) => enabledAlerts[name]) // only consider enabled prayers
                .map(([, timeStr]) => {
                    const [hours, minutes] = timeStr.split(':').map(Number);
                    const date = new Date();
                    date.setHours(hours, minutes, 0, 0);
                    return date;
                });
            
            const upcomingPrayers = prayerTimes
                .filter(pt => pt > now)
                .sort((a, b) => a.getTime() - b.getTime());

            const nextPrayer = upcomingPrayers[0];

            if (nextPrayer) {
                const timeToPrayer = nextPrayer.getTime() - now.getTime();
                timeoutRef.current = window.setTimeout(() => {
                    audioRef.current?.play().catch(e => console.error("Audio play failed:", e));
                    // Optional: set another timeout for the *next* prayer after this one
                }, timeToPrayer);
            }
        }

        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, [enabledAlerts, timings]);


    const prayerNames = [
        { key: 'Fajr', name: 'الفجر' },
        { key: 'Sunrise', name: 'الشروق' },
        { key: 'Dhuhr', name: 'الظهر' },
        { key: 'Asr', name: 'العصر' },
        { key: 'Maghrib', name: 'المغرب' },
        { key: 'Isha', name: 'العشاء' },
    ];

    return (
        <div 
            className="w-full max-w-lg rounded-2xl shadow-2xl flex flex-col p-4 border border-yellow-800/20"
            style={{ backgroundImage: 'var(--color-background-container-gradient)' }}
        >
            <audio ref={audioRef} src="/azan.mp3" preload="auto"></audio>
            <header className="flex-shrink-0 p-4 border-b border-yellow-800/30 flex justify-between items-center">
                <button onClick={onGoHome} className="flex items-center gap-2 px-4 py-2 text-base font-semibold text-white rounded-lg hover:opacity-90 transition-colors" style={{backgroundImage: goldenGradient}}>
                    <HomeIcon className="w-5 h-5"/>
                    <span>الرئيسية</span>
                </button>
                <h2 className="text-2xl font-bold text-dark-gold-gradient flex items-center gap-3">
                    <PrayerTimeIcon className="w-7 h-7" />
                    مواقيت الصلاة
                </h2>
                <div className="w-32"></div> {/* Spacer for centering */}
            </header>

            <main className="flex-grow p-6 text-center">
                {isLoading && <LoadingSpinner text="جاري جلب المواقيت..." />}
                {error && <p className="text-red-700 font-bold bg-red-100 p-3 rounded-lg">{error}</p>}
                {timings && location && (
                    <div className="space-y-4">
                        <div>
                            <p className="text-xl font-bold text-dark-gold-gradient">{location}</p>
                            <p className="text-md text-gray-700">{date}</p>
                        </div>
                        <div className="space-y-3">
                            {prayerNames.map(prayer => (
                                <div key={prayer.key} className="flex justify-between items-center p-3 bg-black/5 rounded-lg border border-white/50">
                                    <div className="text-right">
                                        <p className="font-semibold text-dark-gold-gradient">{prayer.name}</p>
                                        <p className="font-bold text-2xl text-white tracking-wider" style={{ textShadow: '1px 1px 3px rgba(0,0,0,0.4)'}}>
                                            {timings[prayer.key as keyof Timings]}
                                        </p>
                                    </div>
                                    {prayer.key !== 'Sunrise' && (
                                        <label className="relative inline-flex items-center cursor-pointer" title={`تفعيل تنبيه صلاة ${prayer.name}`}>
                                            <input type="checkbox" checked={!!enabledAlerts[prayer.key]} onChange={() => handleToggleAlert(prayer.key)} className="sr-only peer" />
                                            <div className="w-11 h-6 bg-gray-400 rounded-full peer peer-focus:ring-2 peer-focus:ring-yellow-800/50 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                                        </label>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default PrayerTimes;