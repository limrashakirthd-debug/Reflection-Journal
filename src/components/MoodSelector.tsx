import React from 'react';
import { Sparkles, X, SmilePlus, Heart } from 'lucide-react';
import { MoodSentiment, MOOD_CONFIGS } from '../types';

interface MoodSelectorProps {
  selectedSentiment: MoodSentiment | null | undefined;
  onSelectMood: (mood: MoodSentiment | null) => void;
  onApplyPromptSpark?: (spark: string) => void;
  variant?: 'prominent' | 'compact';
  isSaving?: boolean;
}

export function MoodSelector({
  selectedSentiment,
  onSelectMood,
  onApplyPromptSpark,
  variant = 'prominent',
  isSaving = false,
}: MoodSelectorProps) {
  const moods = Object.values(MOOD_CONFIGS);

  if (variant === 'compact') {
    return (
      <div
        id="compact-mood-selector"
        className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1"
      >
        <span className="text-[11px] font-medium text-[#888780] dark:text-[#958f84] uppercase tracking-wider mr-1 shrink-0 flex items-center gap-1">
          <Heart className="w-3 h-3 text-[#c48344] dark:text-[#deb887]" />
          <span>Mood:</span>
        </span>

        {moods.map((m) => {
          const isSelected = selectedSentiment === m.id;
          return (
            <button
              key={m.id}
              id={`mood-compact-btn-${m.id}`}
              type="button"
              disabled={isSaving}
              onClick={() => onSelectMood(isSelected ? null : m.id)}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all whitespace-nowrap cursor-pointer border ${
                isSelected
                  ? `${m.badgeColor} ring-1 ring-current shadow-xs`
                  : 'bg-white dark:bg-[#1e1c1a] text-[#6f6e69] dark:text-[#c5bfb4] hover:bg-[#ebe9e1] dark:hover:bg-[#282521] border-[#e5e4de] dark:border-[#36332e]'
              }`}
              title={`${m.label} — ${m.subtext}`}
            >
              <span>{m.emoji}</span>
              <span>{m.label}</span>
              {isSelected && <span className="text-[10px] opacity-60 ml-0.5">✓</span>}
            </button>
          );
        })}

        {selectedSentiment && (
          <button
            id="clear-mood-compact-btn"
            type="button"
            onClick={() => onSelectMood(null)}
            className="p-1 text-[#888780] hover:text-[#9c2b23] dark:text-[#958f84] dark:hover:text-[#f87171] rounded-full hover:bg-[#f2f1ea] dark:hover:bg-[#282521] transition-colors cursor-pointer shrink-0"
            title="Clear mood tag"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    );
  }

  // Prominent view at the start of a reflection
  return (
    <div
      id="prominent-mood-selector"
      className="p-4 sm:p-5 rounded-2xl border border-[#e5e4de] dark:border-[#36332e] bg-white dark:bg-[#1c1b18] shadow-xs space-y-3.5 text-left transition-all"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#f4ede4] dark:bg-[#2d2419] text-[#8c5b3e] dark:text-[#deb887] flex items-center justify-center border border-[#e8dfd5] dark:border-[#4d3923]">
            <SmilePlus className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-semibold text-[#2d2d2a] dark:text-[#f4efe6] uppercase tracking-wider">
              Check in with yourself
            </h4>
            <p className="text-xs text-[#6f6e69] dark:text-[#c5bfb4]">
              How are you feeling right now as you begin this reflection?
            </p>
          </div>
        </div>

        {selectedSentiment && (
          <button
            id="clear-mood-prominent-btn"
            type="button"
            onClick={() => onSelectMood(null)}
            className="inline-flex items-center gap-1 text-[11px] text-[#888780] hover:text-[#9c2b2b] dark:text-[#958f84] dark:hover:text-[#fca5a5] cursor-pointer transition-colors px-2 py-0.5 rounded-md hover:bg-[#f2f1ea] dark:hover:bg-[#282521]"
          >
            <X className="w-3 h-3" />
            <span>Clear tag</span>
          </button>
        )}
      </div>

      {/* Mood Options Grid */}
      <div
        id="mood-options-grid"
        className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 pt-1"
      >
        {moods.map((m) => {
          const isSelected = selectedSentiment === m.id;
          return (
            <button
              key={m.id}
              id={`mood-btn-${m.id}`}
              type="button"
              disabled={isSaving}
              onClick={() => onSelectMood(isSelected ? null : m.id)}
              className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all cursor-pointer group relative ${
                isSelected
                  ? `${m.badgeColor} ring-2 ring-[#2d2d2a] dark:ring-[#deb887] shadow-sm transform scale-[1.02]`
                  : 'bg-[#fcfbf9] dark:bg-[#22201d] border-[#e5e4de] dark:border-[#36332e] hover:border-[#2d2d2a]/40 dark:hover:border-[#deb887]/50 hover:bg-white dark:hover:bg-[#262420]'
              }`}
            >
              <span className="text-xl sm:text-2xl mb-1 group-hover:scale-110 transition-transform">
                {m.emoji}
              </span>
              <span className="text-xs font-semibold text-[#2d2d2a] dark:text-[#f4efe6] leading-tight">
                {m.label}
              </span>
              <span className="text-[10px] text-[#888780] dark:text-[#958f84] line-clamp-1 leading-tight mt-0.5 hidden sm:block">
                {m.subtext}
              </span>
            </button>
          );
        })}
      </div>

      {/* Mood-inspired Prompt Spark Helper */}
      {selectedSentiment && MOOD_CONFIGS[selectedSentiment] && onApplyPromptSpark && (
        <div
          id="mood-spark-banner"
          className="pt-2 border-t border-[#f2f1ea] dark:border-[#2a2723] flex flex-wrap items-center justify-between gap-2"
        >
          <div className="flex items-center gap-1.5 text-xs text-[#6f6e69] dark:text-[#c5bfb4]">
            <Sparkles className="w-3.5 h-3.5 text-[#c48344] dark:text-[#deb887] shrink-0" />
            <span className="italic">
              &ldquo;{MOOD_CONFIGS[selectedSentiment].promptSpark}&rdquo;
            </span>
          </div>

          <button
            id="apply-mood-spark-btn"
            type="button"
            onClick={() => onApplyPromptSpark(MOOD_CONFIGS[selectedSentiment].promptSpark)}
            className="text-xs font-medium text-[#8c5b3e] dark:text-[#deb887] hover:underline cursor-pointer flex items-center gap-1 shrink-0 ml-auto"
          >
            <span>Start with this prompt</span>
            <span>&rarr;</span>
          </button>
        </div>
      )}
    </div>
  );
}
