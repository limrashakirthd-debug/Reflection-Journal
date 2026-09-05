import { useState, useRef, useEffect } from 'react';
import Markdown from 'react-markdown';
import {
  Send,
  Sparkles,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Copy,
  Check,
  Compass,
  Lightbulb,
  ListTodo,
  HeartHandshake,
  FileText,
  User as UserIcon,
  HelpCircle,
  ArrowDown,
  MapPin,
} from 'lucide-react';
import { JournalInteraction, ReflectionMode, Turn, MoodSentiment, JournalLocation } from '../types';
import { MoodSelector } from './MoodSelector';
import { LocationPinModal } from './LocationPinModal';

interface JournalEditorProps {
  interaction: JournalInteraction | null;
  onSendTurn: (prompt: string, mode: ReflectionMode) => Promise<void>;
  onUpdateTitle: (title: string) => Promise<void>;
  onRetryTurn?: () => Promise<void>;
  isLoading: boolean;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  saveErrorMessage?: string | null;
  onRetrySave?: () => Promise<void>;
  onStartStarterPrompt?: (text: string) => void;
  initialSpark?: string | null;
  onClearInitialSpark?: () => void;
  currentSentiment?: MoodSentiment | null;
  onUpdateSentiment?: (sentiment: MoodSentiment | null) => Promise<void>;
  currentLocation?: JournalLocation | null;
  onUpdateLocation?: (location: JournalLocation | null) => Promise<void>;
}

const MODES: Array<{
  id: ReflectionMode;
  label: string;
  desc: string;
  icon: typeof Compass;
}> = [
  {
    id: 'reflection',
    label: 'Insightful Reflection',
    desc: 'Unpack feelings, thought patterns, and gentle questions',
    icon: Compass,
  },
  {
    id: 'summary',
    label: 'Key Takeaways',
    desc: 'Synthesize core themes, insights, and bullets',
    icon: FileText,
  },
  {
    id: 'brainstorm',
    label: 'Brainstorm Ideas',
    desc: 'Explore fresh angles, possibilities, and alternatives',
    icon: Lightbulb,
  },
  {
    id: 'action_plan',
    label: 'Action Plan',
    desc: 'Break down thoughts into prioritized next steps',
    icon: ListTodo,
  },
  {
    id: 'empathy',
    label: 'Emotional Grounding',
    desc: 'Warm validation, presence, and compassionate grounding',
    icon: HeartHandshake,
  },
];

const STARTER_PROMPTS = [
  {
    title: 'Unpack the Day',
    text: 'Today was full of shifting emotions. I want to unpack what drained my energy and what gave me momentum.',
  },
  {
    title: 'Hesitation on a Decision',
    text: "There's a decision I've been hesitating to make. I'd like to explore the fears and opportunities behind it.",
  },
  {
    title: 'Quiet Celebration',
    text: "Something went unexpectedly well recently, but I haven't slowed down to appreciate it or notice what worked.",
  },
  {
    title: 'Overwhelmed by Options',
    text: 'I have too many ideas and competing priorities. Help me structure my thoughts and find clarity.',
  },
];

export function JournalEditor({
  interaction,
  onSendTurn,
  onUpdateTitle,
  onRetryTurn,
  isLoading,
  saveStatus,
  saveErrorMessage,
  onRetrySave,
  initialSpark,
  onClearInitialSpark,
  currentSentiment,
  onUpdateSentiment,
  currentLocation,
  onUpdateLocation,
}: JournalEditorProps) {
  const [inputText, setInputText] = useState('');
  const [selectedMode, setSelectedMode] = useState<ReflectionMode>(
    interaction?.mode || 'reflection'
  );
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(interaction?.title || '');
  const [copiedTurnId, setCopiedTurnId] = useState<string | null>(null);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);

  const turnsEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSelectMood = async (mood: MoodSentiment | null) => {
    if (onUpdateSentiment) {
      await onUpdateSentiment(mood);
    }
  };

  const handleSaveLocation = async (loc: JournalLocation) => {
    if (onUpdateLocation) {
      await onUpdateLocation(loc);
    }
  };

  const handleRemoveLocation = async () => {
    if (onUpdateLocation) {
      await onUpdateLocation(null);
    }
  };

  // Sync initialSpark if supplied from reminder banner
  useEffect(() => {
    if (initialSpark) {
      setInputText(initialSpark);
      textareaRef.current?.focus();
      if (onClearInitialSpark) {
        onClearInitialSpark();
      }
    }
  }, [initialSpark, onClearInitialSpark]);

  // Sync mode and title when interaction changes
  useEffect(() => {
    if (interaction) {
      setSelectedMode(interaction.mode);
      setTitleValue(interaction.title);
    } else {
      setSelectedMode('reflection');
      setTitleValue('New Reflection');
    }
  }, [interaction?.id, interaction?.mode, interaction?.title]);

  // Scroll to bottom when new turns arrive or loading
  useEffect(() => {
    turnsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [interaction?.turns.length, isLoading]);

  const handleTitleBlur = async () => {
    setEditingTitle(false);
    if (interaction && titleValue.trim() && titleValue !== interaction.title) {
      await onUpdateTitle(titleValue.trim());
    }
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      (e.currentTarget as HTMLElement).blur();
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || isLoading) return;

    const textToSend = inputText.trim();
    // CRITICAL: Defensive persistence guarantee:
    // We send the turn to the parent handler. The parent handler only clears
    // or allows us to clear inputText after settlement!
    try {
      await onSendTurn(textToSend, selectedMode);
      // Cleared only upon successful send & save
      setInputText('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    } catch {
      // Input text is preserved in case of failure so user doesn't lose thoughts!
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleCopyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTurnId(id);
    setTimeout(() => setCopiedTurnId(null), 2000);
  };

  const turns = interaction?.turns || [];

  return (
    <main
      id="journal-editor-main"
      className="flex-1 flex flex-col h-[calc(100vh-57px)] overflow-hidden bg-[#f8f7f2] dark:bg-[#161514]"
    >
      {/* Top Header Bar */}
      <div className="px-4 sm:px-6 py-3 border-b border-[#e5e4de] dark:border-[#36332e] bg-[#f8f7f2]/90 dark:bg-[#161514]/90 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          {editingTitle ? (
            <input
              id="interaction-title-input"
              type="text"
              value={titleValue}
              onChange={(e) => setTitleValue(e.target.value)}
              onBlur={handleTitleBlur}
              onKeyDown={handleTitleKeyDown}
              autoFocus
              className="font-serif font-semibold text-[#2d2d2a] dark:text-[#f4efe6] text-base sm:text-lg border-b border-[#2d2d2a] dark:border-[#deb887] focus:outline-none bg-transparent w-full"
            />
          ) : (
            <h2
              id="interaction-title-display"
              onClick={() => setEditingTitle(true)}
              className="font-serif font-semibold text-[#2d2d2a] dark:text-[#f4efe6] text-base sm:text-lg hover:underline cursor-pointer truncate max-w-md"
              title="Click to rename entry"
            >
              {interaction?.title || 'New Reflection Session'}
            </h2>
          )}
        </div>

        {/* Persistence status badge */}
        <div className="flex items-center gap-2 text-xs">
          {saveStatus === 'saving' && (
            <span
              id="save-status-saving"
              className="inline-flex items-center gap-1.5 text-[#6f6e69] dark:text-[#c5bfb4] font-medium"
            >
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#888780] dark:text-[#deb887]" />
              <span>Saving to Firestore...</span>
            </span>
          )}

          {saveStatus === 'saved' && (
            <span
              id="save-status-saved"
              className="inline-flex items-center gap-1.5 text-[#3b4c3a] dark:text-[#a0cfa0] font-medium"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Saved to Firestore</span>
            </span>
          )}

          {saveStatus === 'error' && (
            <div
              id="save-status-error"
              className="inline-flex items-center gap-2 text-[#9c2b23] dark:text-[#f87171] font-medium bg-[#fcf3f2] dark:bg-[#381816] px-2.5 py-1 rounded-md border border-[#f5c6c2] dark:border-[#5a2420]"
            >
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Save failed</span>
              {onRetrySave && (
                <button
                  onClick={onRetrySave}
                  className="underline hover:text-[#791f19] dark:hover:text-[#fca5a5] cursor-pointer font-bold"
                >
                  Retry
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Mode Selector Pill Bar */}
      <div
        id="mode-selector-bar"
        className="px-4 sm:px-6 py-2 bg-[#f2f1ea] dark:bg-[#181615] border-b border-[#e5e4de] dark:border-[#36332e] flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0"
      >
        <span className="text-[11px] font-medium text-[#888780] dark:text-[#958f84] uppercase tracking-wider mr-1 hidden sm:inline">
          Mode:
        </span>
        {MODES.map((m) => {
          const Icon = m.icon;
          const isSelected = selectedMode === m.id;
          return (
            <button
              key={m.id}
              onClick={() => setSelectedMode(m.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
                isSelected
                  ? 'bg-[#2d2d2a] dark:bg-[#deb887] text-[#f8f7f2] dark:text-[#161514] shadow-xs'
                  : 'bg-white dark:bg-[#1e1c1a] text-[#6f6e69] dark:text-[#c5bfb4] hover:bg-[#ebe9e1] dark:hover:bg-[#282521] border border-[#e5e4de] dark:border-[#36332e]'
              }`}
              title={m.desc}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{m.label}</span>
            </button>
          );
        })}

        <div className="h-4 w-px bg-[#e5e4de] dark:bg-[#36332e] mx-1 shrink-0" />

        {/* Compact Mood Selector in Toolbar */}
        <MoodSelector
          selectedSentiment={currentSentiment}
          onSelectMood={handleSelectMood}
          variant="compact"
          isSaving={saveStatus === 'saving'}
        />

        <div className="h-4 w-px bg-[#e5e4de] dark:bg-[#36332e] mx-1 shrink-0" />

        {/* Location Pin Button in Toolbar */}
        <button
          id="location-pin-toolbar-btn"
          type="button"
          onClick={() => setIsLocationModalOpen(true)}
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all whitespace-nowrap cursor-pointer border ${
            currentLocation
              ? 'bg-[#f4ede4] dark:bg-[#2d251d] text-[#8c5b3e] dark:text-[#deb887] border-[#e2d5c5] dark:border-[#4d3b2b] shadow-xs'
              : 'bg-white dark:bg-[#1e1c1a] text-[#6f6e69] dark:text-[#c5bfb4] hover:bg-[#ebe9e1] dark:hover:bg-[#282521] border-[#e5e4de] dark:border-[#36332e]'
          }`}
          title={
            currentLocation
              ? `Pinned location: ${currentLocation.name} (${currentLocation.lat.toFixed(2)}, ${currentLocation.lng.toFixed(2)}) • Click to view or edit`
              : 'Pin a geographic location to this reflection'
          }
        >
          <MapPin className={`w-3.5 h-3.5 ${currentLocation ? 'text-[#8c5b3e] dark:text-[#deb887]' : ''}`} />
          <span className="max-w-[120px] truncate">{currentLocation ? currentLocation.name : 'Pin Location'}</span>
        </button>
      </div>

      {/* Turns Stream / Messages Container */}
      <div
        id="turns-scroll-container"
        className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 space-y-6 bg-[#f8f7f2] dark:bg-[#161514]"
      >
        {turns.length === 0 ? (
          /* Empty State / Starter Prompts */
          <div className="max-w-2xl mx-auto py-6 text-center space-y-6">
            <div className="space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-[#f4ede4] dark:bg-[#282119] text-[#8c5b3e] dark:text-[#deb887] flex items-center justify-center mx-auto border border-[#e8dfd5] dark:border-[#453422]">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className="font-serif text-xl font-medium text-[#2d2d2a] dark:text-[#f4efe6]">
                What thoughts would you like to explore?
              </h3>
              <p className="text-sm text-[#6f6e69] dark:text-[#c5bfb4] max-w-md mx-auto leading-relaxed">
                Write freely below or choose a starter spark to begin this journal entry. Gemini will provide thoughtful reflections and continue the conversation with you.
              </p>
            </div>

            {/* Prominent Mood Selector at the start of reflection */}
            <MoodSelector
              selectedSentiment={currentSentiment}
              onSelectMood={handleSelectMood}
              onApplyPromptSpark={(spark) => {
                setInputText(spark);
                textareaRef.current?.focus();
              }}
              variant="prominent"
              isSaving={saveStatus === 'saving'}
            />

            {/* Prompt Spark Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-left">
              {STARTER_PROMPTS.map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setInputText(prompt.text);
                    textareaRef.current?.focus();
                  }}
                  className="p-3.5 rounded-xl border border-[#e5e4de] dark:border-[#36332e] bg-white dark:bg-[#1e1c1a] hover:border-[#2d2d2a] dark:hover:border-[#deb887] hover:shadow-xs hover:dark:bg-[#24221f] transition-all text-left group cursor-pointer"
                >
                  <div className="flex items-center justify-between text-xs font-semibold text-[#2d2d2a] dark:text-[#f4efe6] mb-1">
                    <span>{prompt.title}</span>
                    <Sparkles className="w-3 h-3 text-[#888780] dark:text-[#958f84] group-hover:text-[#c48344] dark:group-hover:text-[#deb887] transition-colors" />
                  </div>
                  <p className="text-xs text-[#6f6e69] dark:text-[#c5bfb4] line-clamp-2 leading-relaxed">
                    {prompt.text}
                  </p>
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Multi-Turn Dialogue */
          <div className="max-w-3xl mx-auto space-y-6">
            {turns.map((turn, index) => {
              const isUser = turn.role === 'user';

              return (
                <div
                  key={turn.id || index}
                  id={`turn-${index}`}
                  className={`flex gap-3.5 sm:gap-4 ${
                    isUser ? 'items-start' : 'items-start'
                  }`}
                >
                  {/* Avatar / Role Emblem */}
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                      isUser
                        ? 'bg-[#2d2d2a] dark:bg-[#deb887] text-[#f8f7f2] dark:text-[#161514]'
                        : 'bg-[#f4ede4] dark:bg-[#282119] text-[#8c5b3e] dark:text-[#deb887] border border-[#e8dfd5] dark:border-[#453422]'
                    }`}
                  >
                    {isUser ? (
                      <UserIcon className="w-4 h-4" />
                    ) : (
                      <Sparkles className="w-4 h-4 text-[#8c5b3e] dark:text-[#deb887]" />
                    )}
                  </div>

                  {/* Bubble Content */}
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-[#2d2d2a] dark:text-[#f4efe6]">
                          {isUser ? 'You' : 'Gemini 3.6 Flash'}
                        </span>
                        {!isUser && turn.modelUsed && (
                          <span className="text-[10px] font-mono text-[#6f6e69] dark:text-[#deb887] bg-[#ebe9e1] dark:bg-[#282521] px-1.5 py-0.5 rounded">
                            {turn.modelUsed}
                          </span>
                        )}
                        <span className="text-[11px] text-[#888780] dark:text-[#958f84]">
                          {new Date(turn.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>

                      {/* Copy turn */}
                      <button
                        onClick={() => handleCopyText(turn.id, turn.text)}
                        className="p-1 text-[#888780] dark:text-[#958f84] hover:text-[#2d2d2a] dark:hover:text-[#f4efe6] rounded transition-colors cursor-pointer"
                        title="Copy text"
                      >
                        {copiedTurnId === turn.id ? (
                          <Check className="w-3.5 h-3.5 text-[#3b4c3a] dark:text-[#4ade80]" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>

                    {/* Content Card */}
                    <div
                      className={`p-4 rounded-2xl text-sm leading-relaxed ${
                        isUser
                          ? 'bg-[#f2f1ea] dark:bg-[#22201d] text-[#2d2d2a] dark:text-[#f4efe6] border border-[#e5e4de] dark:border-[#36332e] font-serif whitespace-pre-wrap'
                          : 'bg-white dark:bg-[#1c1b18] text-[#2d2d2a] dark:text-[#f4efe6] border border-[#e5e4de] dark:border-[#36332e] shadow-xs'
                      }`}
                    >
                      {isUser ? (
                        turn.text
                      ) : (
                        <div className="prose max-w-none text-sm leading-relaxed space-y-3 text-[#2d2d2a] dark:text-[#f4efe6]">
                          <Markdown>{turn.text}</Markdown>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* AI Loading indicator */}
            {isLoading && (
              <div
                id="turn-generating-indicator"
                className="flex items-start gap-4"
              >
                <div className="w-8 h-8 rounded-lg bg-[#f4ede4] dark:bg-[#282119] text-[#8c5b3e] dark:text-[#deb887] border border-[#e8dfd5] dark:border-[#453422] flex items-center justify-center shrink-0 animate-pulse">
                  <Sparkles className="w-4 h-4 text-[#8c5b3e] dark:text-[#deb887]" />
                </div>
                <div className="flex-1 bg-white dark:bg-[#1c1b18] border border-[#e5e4de] dark:border-[#36332e] rounded-2xl p-4 shadow-xs space-y-2.5">
                  <div className="flex items-center gap-2 text-xs font-medium text-[#6f6e69] dark:text-[#c5bfb4]">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#c48344] dark:text-[#deb887]" />
                    <span>Gemini is reflecting on your entry...</span>
                  </div>
                  <div className="space-y-2">
                    <div className="h-3 bg-[#f2f1ea] dark:bg-[#282521] rounded-full w-4/5 animate-pulse" />
                    <div className="h-3 bg-[#f2f1ea] dark:bg-[#282521] rounded-full w-3/5 animate-pulse" />
                  </div>
                </div>
              </div>
            )}

            {/* Error Banner with Retry */}
            {saveErrorMessage && (
              <div
                id="turn-error-banner"
                className="p-4 bg-[#fcf3f2] dark:bg-[#381816] border border-[#f5c6c2] dark:border-[#5a2420] rounded-xl text-[#9c2b23] dark:text-[#f87171] text-xs flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-[#9c2b23] dark:text-[#f87171] shrink-0" />
                  <span>{saveErrorMessage}</span>
                </div>
                {onRetryTurn && (
                  <button
                    onClick={onRetryTurn}
                    className="px-3 py-1.5 bg-[#9c2b23] hover:bg-[#791f19] dark:bg-[#b91c1c] dark:hover:bg-[#991b1b] text-white font-medium rounded-lg text-xs transition-colors shrink-0 cursor-pointer"
                  >
                    Retry
                  </button>
                )}
              </div>
            )}

            <div ref={turnsEndRef} />
          </div>
        )}
      </div>

      {/* Input Composer Tray */}
      <div
        id="composer-tray"
        className="p-3 sm:p-4 border-t border-[#e5e4de] dark:border-[#36332e] bg-[#f8f7f2]/95 dark:bg-[#161514]/95 shrink-0"
      >
        <div className="max-w-3xl mx-auto">
          <form onSubmit={handleSubmit} className="relative">
            <textarea
              ref={textareaRef}
              id="reflection-prompt-input"
              value={inputText}
              onChange={(e) => {
                setInputText(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = `${Math.min(e.target.scrollHeight, 180)}px`;
              }}
              onKeyDown={handleKeyDown}
              placeholder={
                turns.length === 0
                  ? `Write your thoughts, reflections, or questions here... (${MODES.find((m) => m.id === selectedMode)?.label})`
                  : 'Continue the reflection or respond to Gemini...'
              }
              rows={2}
              disabled={isLoading}
              className="w-full pl-4 pr-14 py-3 bg-white dark:bg-[#1e1c1a] border border-[#dedcd5] dark:border-[#36332e] rounded-xl text-[#2d2d2a] dark:text-[#f4efe6] placeholder:text-[#888780] dark:placeholder:text-[#958f84] text-sm focus:outline-none focus:ring-1 focus:ring-[#2d2d2a] dark:focus:ring-[#deb887] focus:border-[#2d2d2a] dark:focus:border-[#deb887] resize-none shadow-xs disabled:opacity-60 transition-all font-sans"
            />

            {/* Send Button */}
            <button
              id="send-prompt-btn"
              type="submit"
              disabled={!inputText.trim() || isLoading}
              className="absolute right-2.5 bottom-3.5 p-2 bg-[#2d2d2a] hover:bg-[#42413d] dark:bg-[#deb887] dark:hover:bg-[#e8c799] text-[#f8f7f2] dark:text-[#161514] disabled:bg-[#dedcd5] dark:disabled:bg-[#282521] disabled:text-[#888780] dark:disabled:text-[#656056] rounded-lg transition-all shadow-xs cursor-pointer active:scale-95 disabled:pointer-events-none"
              title="Send entry (Enter)"
            >
              {isLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin text-[#deb887] dark:text-[#161514]" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </form>

          <div className="mt-2 flex items-center justify-between text-[11px] text-[#888780] dark:text-[#958f84] px-1">
            <span>
              Press <kbd className="font-mono bg-[#ebe9e1] dark:bg-[#282521] text-[#2d2d2a] dark:text-[#f4efe6] px-1 py-0.5 rounded text-[10px]">Enter</kbd> to reflect, <kbd className="font-mono bg-[#ebe9e1] dark:bg-[#282521] text-[#2d2d2a] dark:text-[#f4efe6] px-1 py-0.5 rounded text-[10px]">Shift + Enter</kbd> for new line
            </span>
            <span>{inputText.length} characters</span>
          </div>
        </div>
      </div>

      {/* Location Pin Modal */}
      <LocationPinModal
        isOpen={isLocationModalOpen}
        onClose={() => setIsLocationModalOpen(false)}
        currentLocation={currentLocation}
        onSaveLocation={handleSaveLocation}
        onRemoveLocation={handleRemoveLocation}
        isSaving={saveStatus === 'saving'}
      />
    </main>
  );
}
