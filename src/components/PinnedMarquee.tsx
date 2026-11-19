import { Megaphone } from 'lucide-react';
import { useApp } from '../context/AppContext';

export function PinnedMarquee() {
  const { catalog } = useApp();
  const settings = catalog?.settings;

  if (!settings?.pinnedTickerEnabled || !settings?.pinnedTickerText) {
    return null;
  }

  const themeClass =
    settings.pinnedTickerTheme === 'purple'
      ? 'bg-gradient-to-r from-violet-700 via-purple-600 to-fuchsia-600 text-white'
      : settings.pinnedTickerTheme === 'blue'
        ? 'bg-gradient-to-r from-blue-600 to-sky-500 text-white'
        : settings.pinnedTickerTheme === 'amber'
          ? 'bg-amber-500 text-slate-950'
          : 'bg-slate-900 text-slate-100 border border-slate-800';

  const items = [0, 1, 2, 3];
  const trackContent = (
    <div className="flex items-center shrink-0">
      {items.map((idx) => (
        <span
          key={idx}
          className="inline-flex items-center gap-2 text-xs font-semibold tracking-wide px-10"
        >
          <Megaphone className="w-3.5 h-3.5 shrink-0" />
          <span>{settings.pinnedTickerText}</span>
        </span>
      ))}
    </div>
  );

  return (
    <div
      className={`w-full h-10 rounded-xl overflow-hidden flex items-center select-none shadow-xs ${themeClass}`}
      role="region"
      aria-label="Pinned announcement"
    >
      <div className="w-full overflow-hidden">
        <div className="animate-marquee-rtl">
          {trackContent}
          {trackContent}
        </div>
      </div>
    </div>
  );
}
