import { useState, useMemo } from 'react';
import {
  Search,
  Star,
  Trash2,
  Calendar,
  Sparkles,
  ChevronRight,
  X,
  FileText,
  Filter,
  SmilePlus,
  MapPin,
} from 'lucide-react';
import { JournalInteraction, ReflectionMode, MoodSentiment, MOOD_CONFIGS } from '../types';

interface HistorySidebarProps {
  interactions: JournalInteraction[];
  activeId: string | null;
  onSelectInteraction: (id: string) => void;
  onDeleteInteraction: (id: string) => Promise<void>;
  onToggleFavorite: (id: string, current: boolean) => Promise<void>;
  isOpen: boolean;
  onClose: () => void;
}

const MODE_LABELS: Record<ReflectionMode, { label: string; color: string }> = {
  reflection: {
    label: 'Reflection',
    color: 'bg-[#f4ede4] text-[#8c5b3e] border-[#e8dfd5] dark:bg-[#2e2318] dark:text-[#deb887] dark:border-[#4d3620]',
  },
  summary: {
    label: 'Summary',
    color: 'bg-[#eef3f7] text-[#3d5a73] border-[#d8e3eb] dark:bg-[#1b2631] dark:text-[#9dc0e6] dark:border-[#2a3c4f]',
  },
  brainstorm: {
    label: 'Brainstorm',
    color: 'bg-[#f7f1f7] text-[#6d4c6d] border-[#eadcea] dark:bg-[#2c1d2e] dark:text-[#dfb2e2] dark:border-[#4a2e4e]',
  },
  action_plan: {
    label: 'Action Plan',
    color: 'bg-[#e9f0e8] text-[#3b543a] border-[#d5e3d4] dark:bg-[#1a2b1c] dark:text-[#a5d6a7] dark:border-[#2b482e]',
  },
  empathy: {
    label: 'Empathy',
    color: 'bg-[#fbf0ee] text-[#8f473c] border-[#f2deda] dark:bg-[#301b19] dark:text-[#ef9a9a] dark:border-[#522925]',
  },
};

export function HistorySidebar({
  interactions,
  activeId,
  onSelectInteraction,
  onDeleteInteraction,
  onToggleFavorite,
  isOpen,
  onClose,
}: HistorySidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'favorites' | ReflectionMode | MoodSentiment>('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Filtered interactions
  const filteredInteractions = useMemo(() => {
    return interactions.filter((item) => {
      // Filter tab
      if (selectedFilter === 'favorites' && !item.favorite) return false;
      if (selectedFilter !== 'all' && selectedFilter !== 'favorites') {
        if (selectedFilter in MOOD_CONFIGS) {
          if (item.sentiment !== selectedFilter) return false;
        } else if (item.mode !== selectedFilter) {
          return false;
        }
      }

      // Search query
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const inTitle = (item.title || '').toLowerCase().includes(q);
      const inTurns = (item.turns || []).some((t) =>
        t.text.toLowerCase().includes(q)
      );
      const inSentiment = item.sentiment
        ? item.sentiment.toLowerCase().includes(q) ||
          (MOOD_CONFIGS[item.sentiment]?.label.toLowerCase().includes(q) ?? false)
        : false;
      const inLocation = item.location
        ? item.location.name.toLowerCase().includes(q) ||
          (item.location.address || '').toLowerCase().includes(q)
        : false;
      return inTitle || inTurns || inSentiment || inLocation;
    });
  }, [interactions, searchQuery, selectedFilter]);

  const handleDeleteClick = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (deletingId === id) {
      await onDeleteInteraction(id);
      setDeletingId(null);
    } else {
      setDeletingId(id);
      setTimeout(() => {
        setDeletingId((curr) => (curr === id ? null : curr));
      }, 4000);
    }
  };

  const handleFavoriteClick = async (
    e: React.MouseEvent,
    id: string,
    current: boolean
  ) => {
    e.stopPropagation();
    await onToggleFavorite(id, current);
  };

  function formatDate(timestamp: number): string {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();

    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  return (
    <>
      {/* Backdrop for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-[#2d2d2a]/30 dark:bg-black/60 backdrop-blur-xs z-30 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        id="history-sidebar"
        className={`fixed lg:static top-[57px] bottom-0 left-0 z-30 w-80 sm:w-88 bg-[#f8f7f2] dark:bg-[#181615] border-r border-[#e5e4de] dark:border-[#36332e] flex flex-col transition-transform duration-200 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Header */}
        <div className="p-3.5 border-b border-[#e5e4de] dark:border-[#36332e] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#2d2d2a] dark:text-[#f4efe6]" />
            <h2 className="font-medium text-[#2d2d2a] dark:text-[#f4efe6] text-sm">Past Reflections</h2>
            <span className="text-xs bg-[#ebe9e1] dark:bg-[#282521] text-[#2d2d2a] dark:text-[#c5bfb4] px-2 py-0.5 rounded-full font-mono">
              {interactions.length}
            </span>
          </div>

          <button
            onClick={onClose}
            className="lg:hidden p-1 text-[#6f6e69] dark:text-[#c5bfb4] hover:text-[#2d2d2a] dark:hover:text-[#f4efe6] rounded-md cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-[#e5e4de] dark:border-[#36332e] space-y-2.5">
          <div className="relative">
            <Search className="w-4 h-4 text-[#888780] dark:text-[#958f84] absolute left-3 top-2.5" />
            <input
              id="history-search-input"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search past entries..."
              className="w-full pl-9 pr-7 py-1.5 bg-white dark:bg-[#1e1c1a] border border-[#e5e4de] dark:border-[#36332e] text-[#2d2d2a] dark:text-[#f4efe6] placeholder:text-[#888780] dark:placeholder:text-[#958f84] text-xs rounded-lg focus:outline-none focus:ring-1 focus:ring-[#2d2d2a] dark:focus:ring-[#deb887] focus:border-[#2d2d2a] dark:focus:border-[#deb887]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-2 text-[#888780] dark:text-[#958f84] hover:text-[#2d2d2a] dark:hover:text-[#f4efe6] cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick Filter Pills */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[11px] no-scrollbar">
            <button
              onClick={() => setSelectedFilter('all')}
              className={`px-2 py-0.5 rounded-full whitespace-nowrap transition-colors cursor-pointer ${
                selectedFilter === 'all'
                  ? 'bg-[#2d2d2a] dark:bg-[#deb887] text-[#f8f7f2] dark:text-[#161514] font-medium'
                  : 'bg-[#ebe9e1] dark:bg-[#282521] text-[#6f6e69] dark:text-[#c5bfb4] hover:bg-[#e5e4de] dark:hover:bg-[#36332e]'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setSelectedFilter('favorites')}
              className={`px-2 py-0.5 rounded-full whitespace-nowrap transition-colors flex items-center gap-1 cursor-pointer ${
                selectedFilter === 'favorites'
                  ? 'bg-[#c48344] text-[#f8f7f2] dark:text-[#161514] font-medium'
                  : 'bg-[#ebe9e1] dark:bg-[#282521] text-[#6f6e69] dark:text-[#c5bfb4] hover:bg-[#e5e4de] dark:hover:bg-[#36332e]'
              }`}
            >
              <Star className="w-3 h-3 fill-current" />
              <span>Starred</span>
            </button>
            <button
              onClick={() => setSelectedFilter('reflection')}
              className={`px-2 py-0.5 rounded-full whitespace-nowrap transition-colors cursor-pointer ${
                selectedFilter === 'reflection'
                  ? 'bg-[#2d2d2a] dark:bg-[#deb887] text-[#f8f7f2] dark:text-[#161514] font-medium'
                  : 'bg-[#ebe9e1] dark:bg-[#282521] text-[#6f6e69] dark:text-[#c5bfb4] hover:bg-[#e5e4de] dark:hover:bg-[#36332e]'
              }`}
            >
              Reflection
            </button>
            <button
              onClick={() => setSelectedFilter('summary')}
              className={`px-2 py-0.5 rounded-full whitespace-nowrap transition-colors cursor-pointer ${
                selectedFilter === 'summary'
                  ? 'bg-[#2d2d2a] dark:bg-[#deb887] text-[#f8f7f2] dark:text-[#161514] font-medium'
                  : 'bg-[#ebe9e1] dark:bg-[#282521] text-[#6f6e69] dark:text-[#c5bfb4] hover:bg-[#e5e4de] dark:hover:bg-[#36332e]'
              }`}
            >
              Summary
            </button>
            <button
              onClick={() => setSelectedFilter('brainstorm')}
              className={`px-2 py-0.5 rounded-full whitespace-nowrap transition-colors cursor-pointer ${
                selectedFilter === 'brainstorm'
                  ? 'bg-[#2d2d2a] dark:bg-[#deb887] text-[#f8f7f2] dark:text-[#161514] font-medium'
                  : 'bg-[#ebe9e1] dark:bg-[#282521] text-[#6f6e69] dark:text-[#c5bfb4] hover:bg-[#e5e4de] dark:hover:bg-[#36332e]'
              }`}
            >
              Brainstorm
            </button>
            {/* Active Mood Filter Pill */}
            {selectedFilter in MOOD_CONFIGS && (
              <button
                id="active-mood-filter-pill"
                onClick={() => setSelectedFilter('all')}
                className="px-2 py-0.5 rounded-full whitespace-nowrap transition-colors inline-flex items-center gap-1 bg-[#2d2d2a] dark:bg-[#deb887] text-[#f8f7f2] dark:text-[#161514] font-medium cursor-pointer shadow-xs"
                title="Click to remove mood filter"
              >
                <span>{MOOD_CONFIGS[selectedFilter as MoodSentiment]?.emoji}</span>
                <span>{MOOD_CONFIGS[selectedFilter as MoodSentiment]?.label}</span>
                <X className="w-2.5 h-2.5 ml-0.5" />
              </button>
            )}
          </div>
        </div>

        {/* Interaction List */}
        <div
          id="history-list-container"
          className="flex-1 overflow-y-auto p-2.5 space-y-1.5"
        >
          {filteredInteractions.length === 0 ? (
            <div className="py-12 px-4 text-center text-[#888780] dark:text-[#958f84] space-y-2">
              <FileText className="w-8 h-8 mx-auto stroke-1 opacity-60" />
              <p className="text-xs">
                {searchQuery || selectedFilter !== 'all'
                  ? 'No entries match this filter.'
                  : 'No saved reflections yet. Start a new journal entry to begin!'}
              </p>
            </div>
          ) : (
            filteredInteractions.map((item) => {
              const isActive = item.id === activeId;
              const modeMeta = MODE_LABELS[item.mode] || MODE_LABELS.reflection;
              const latestUserText =
                item.turns.find((t) => t.role === 'user')?.text || '';

              return (
                <div
                  key={item.id}
                  id={`history-item-${item.id}`}
                  onClick={() => {
                    onSelectInteraction(item.id);
                    if (window.innerWidth < 1024) onClose();
                  }}
                  className={`group relative p-3 rounded-xl border transition-all cursor-pointer text-left ${
                    isActive
                      ? 'bg-white dark:bg-[#24221f] border-[#2d2d2a] dark:border-[#deb887] shadow-xs ring-1 ring-[#2d2d2a]/10 dark:ring-[#deb887]/20'
                      : 'bg-[#f2f1ea]/60 dark:bg-[#1e1c1a]/80 hover:bg-white dark:hover:bg-[#24221f] border-[#e5e4de] dark:border-[#36332e] hover:border-[#dedcd5] dark:hover:border-[#45413b]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${modeMeta.color}`}
                      >
                        {modeMeta.label}
                      </span>

                      {/* Sentiment / Mood Badge */}
                      {item.sentiment && MOOD_CONFIGS[item.sentiment] && (
                        <span
                          id={`history-item-mood-${item.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedFilter(item.sentiment as MoodSentiment);
                          }}
                          className={`text-[10px] font-medium px-2 py-0.5 rounded-full border inline-flex items-center gap-1 cursor-pointer transition-transform hover:scale-105 ${
                            MOOD_CONFIGS[item.sentiment].badgeColor
                          }`}
                          title={`Mood: ${MOOD_CONFIGS[item.sentiment].label} (${MOOD_CONFIGS[item.sentiment].subtext}) • Click to filter by this mood`}
                        >
                          <span>{MOOD_CONFIGS[item.sentiment].emoji}</span>
                          <span>{MOOD_CONFIGS[item.sentiment].label}</span>
                        </span>
                      )}

                      {/* Location Badge */}
                      {item.location && (
                        <span
                          id={`history-item-location-${item.id}`}
                          className="text-[10px] font-medium px-2 py-0.5 rounded-full border border-[#e8dfd5] dark:border-[#42382e] bg-[#f8f5ee] dark:bg-[#25201a] text-[#8c5b3e] dark:text-[#deb887] inline-flex items-center gap-1 max-w-[130px] truncate"
                          title={`Pinned Location: ${item.location.name}${item.location.address ? ` (${item.location.address})` : ''} • [${item.location.lat.toFixed(2)}, ${item.location.lng.toFixed(2)}]`}
                        >
                          <MapPin className="w-2.5 h-2.5 shrink-0" />
                          <span className="truncate">{item.location.name}</span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 text-[11px] text-[#888780] dark:text-[#958f84] shrink-0">
                      <span>{formatDate(item.updatedAt)}</span>
                      <button
                        onClick={(e) =>
                          handleFavoriteClick(e, item.id, Boolean(item.favorite))
                        }
                        className={`p-1 rounded transition-colors cursor-pointer ${
                          item.favorite
                            ? 'text-[#c48344] dark:text-[#deb887]'
                            : 'text-[#dedcd5] dark:text-[#45413b] hover:text-[#c48344] dark:hover:text-[#deb887] opacity-60 group-hover:opacity-100'
                        }`}
                        title={item.favorite ? 'Remove star' : 'Star reflection'}
                      >
                        <Star
                          className={`w-3.5 h-3.5 ${item.favorite ? 'fill-current' : ''}`}
                        />
                      </button>
                    </div>
                  </div>

                  <h3 className="text-xs font-semibold text-[#2d2d2a] dark:text-[#f4efe6] leading-snug line-clamp-1 mb-1">
                    {item.title || 'Untitled Reflection'}
                  </h3>

                  <p className="text-[11px] text-[#6f6e69] dark:text-[#c5bfb4] line-clamp-2 leading-relaxed">
                    {latestUserText || 'No text recorded'}
                  </p>

                  <div className="mt-2 pt-2 border-t border-[#e5e4de]/60 dark:border-[#36332e]/60 flex items-center justify-between text-[10px] text-[#888780] dark:text-[#958f84]">
                    <span className="flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-[#c48344] dark:text-[#deb887]" />
                      {item.turns.length} turn{item.turns.length !== 1 ? 's' : ''}
                    </span>

                    {/* Delete action */}
                    <button
                      onClick={(e) => handleDeleteClick(e, item.id)}
                      className={`px-1.5 py-0.5 rounded transition-all cursor-pointer ${
                        deletingId === item.id
                          ? 'bg-[#9c2b23] text-white font-medium'
                          : 'opacity-0 group-hover:opacity-100 hover:bg-[#fcf3f2] dark:hover:bg-[#381816] text-[#888780] dark:text-[#958f84] hover:text-[#9c2b23] dark:hover:text-[#f87171]'
                      }`}
                      title={
                        deletingId === item.id
                          ? 'Click again to permanently delete'
                          : 'Delete entry'
                      }
                    >
                      {deletingId === item.id ? (
                        'Confirm?'
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </aside>
    </>
  );
}
