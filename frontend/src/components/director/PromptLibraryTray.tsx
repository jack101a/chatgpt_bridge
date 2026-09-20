import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Sparkles,
  Plus,
  X,
  Search,
  Wand2,
  Copy,
  Check,
  ArrowLeft,
  Filter,
  ExternalLink,
  Layers,
  ChevronDown,
  Loader2,
  Maximize2,
} from 'lucide-react';
import { PromptLibraryData, CuratedPrompt, PromptTaxonomy } from '../../types';
import { api } from '../../lib/api';
import { PromptCard } from './PromptCard';

interface PromptLibraryTrayProps {
  onInsertModifier: (text: string) => void;
  onUseCuratedPrompt?: (text: string, enhance?: boolean) => void;
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'chips' | 'gallery';
}

export function PromptLibraryTray({
  onInsertModifier,
  onUseCuratedPrompt,
  isOpen,
  onClose,
  initialTab = 'chips',
}: PromptLibraryTrayProps) {
  // ── Mode Switch ──
  const [activeTab, setActiveTab] = useState<'chips' | 'gallery'>(initialTab);

  // ── Chips State (Legacy Modifiers) ──
  const [chipsData, setChipsData] = useState<PromptLibraryData | null>(null);
  const [activeChipCategory, setActiveChipCategory] = useState<string>('camera_angles');
  const [newChipText, setNewChipText] = useState('');
  const [isAddingChip, setIsAddingChip] = useState(false);

  // ── Gallery State (1,003 Curated Prompts) ──
  const [taxonomy, setTaxonomy] = useState<PromptTaxonomy | null>(null);
  const [prompts, setPrompts] = useState<CuratedPrompt[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStyle, setSelectedStyle] = useState<string>('all');
  const [selectedScene, setSelectedScene] = useState<string>('all');
  const [selectedSource, setSelectedSource] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [inspectPrompt, setInspectPrompt] = useState<CuratedPrompt | null>(null);
  const [copiedInspect, setCopiedInspect] = useState(false);
  const [showStyleFilter, setShowStyleFilter] = useState(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // ── Initial Load ──
  useEffect(() => {
    if (isOpen) {
      loadChipsData();
      loadTaxonomy();
    }
  }, [isOpen]);

  // ── Load Gallery when switching tabs or filters change ──
  useEffect(() => {
    if (isOpen && activeTab === 'gallery') {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
      searchDebounceRef.current = setTimeout(() => {
        loadGallery(1, false);
      }, 250);
    }
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [isOpen, activeTab, selectedCategory, selectedStyle, selectedScene, selectedSource, searchQuery]);

  const loadChipsData = async () => {
    try {
      const res = await api.getPromptLibrary();
      setChipsData(res);
    } catch (e) {
      console.error('Failed to load chip library:', e);
    }
  };

  const loadTaxonomy = async () => {
    try {
      const res = await api.getPromptTaxonomy();
      setTaxonomy(res);
    } catch (e) {
      console.error('Failed to load taxonomy:', e);
    }
  };

  const loadGallery = async (pageNum: number, append: boolean = false) => {
    if (append) {
      setIsLoadingMore(true);
    } else {
      setIsLoading(true);
    }

    try {
      const res = await api.getPromptGallery({
        category: selectedCategory !== 'all' ? selectedCategory : undefined,
        style: selectedStyle !== 'all' ? selectedStyle : undefined,
        scene: selectedScene !== 'all' ? selectedScene : undefined,
        source: selectedSource !== 'all' ? selectedSource : undefined,
        search: searchQuery.trim() || undefined,
        page: pageNum,
        per_page: 20,
      });

      if (append) {
        setPrompts((prev) => [...prev, ...res.prompts]);
      } else {
        setPrompts(res.prompts);
      }
      setPage(res.page);
      setTotalPages(res.pages);
      setTotalCount(res.total);
    } catch (e) {
      console.error('Failed to load curated prompt gallery:', e);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  };

  const handleLoadMore = () => {
    if (page < totalPages && !isLoadingMore) {
      loadGallery(page + 1, true);
    }
  };

  // ── Prompt Insertion Handler ──
  const handleUsePrompt = (prompt: CuratedPrompt, enhance: boolean = false) => {
    if (onUseCuratedPrompt) {
      onUseCuratedPrompt(prompt.prompt, enhance);
    } else {
      onInsertModifier(prompt.prompt);
    }
    onClose();
  };

  const handleCopyInspect = () => {
    if (!inspectPrompt) return;
    navigator.clipboard.writeText(inspectPrompt.prompt);
    setCopiedInspect(true);
    setTimeout(() => setCopiedInspect(false), 2000);
  };

  // ── Custom Chip CRUD ──
  const handleAddCustom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChipText.trim()) return;
    try {
      await api.addCustomChip(newChipText.trim());
      setNewChipText('');
      setIsAddingChip(false);
      await loadChipsData();
    } catch (e) {
      console.error('Failed to add custom chip:', e);
    }
  };

  const handleDeleteCustom = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.deleteCustomChip(id);
      await loadChipsData();
    } catch (e) {
      console.error('Failed to delete custom chip:', e);
    }
  };

  if (!isOpen) return null;

  const chipCategoryLabels: Record<string, string> = {
    camera_angles: 'Camera Angles',
    lighting: 'Lighting & Atmosphere',
    film_styles: 'Film Styles & Mediums',
    custom: 'My Presets',
  };

  return (
    <div className="border-b border-border bg-card/95 backdrop-blur-md p-3 animate-in slide-in-from-top-2 duration-200">
      <div className="max-w-4xl mx-auto space-y-3">
        {/* ── Top Bar: Mode Tabs + Global Close ── */}
        <div className="flex items-center justify-between gap-2 pb-1 border-b border-border/50">
          {/* Mode Tabs */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                setActiveTab('chips');
                setInspectPrompt(null);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all min-h-[32px] ${
                activeTab === 'chips'
                  ? 'bg-foreground text-background shadow-xs'
                  : 'bg-muted/70 text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              <Sparkles size={13} className={activeTab === 'chips' ? 'text-primary' : ''} />
              <span>Modifier Chips</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('gallery');
                setInspectPrompt(null);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all min-h-[32px] ${
                activeTab === 'gallery'
                  ? 'bg-foreground text-background shadow-xs'
                  : 'bg-muted/70 text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              <Layers size={13} className={activeTab === 'gallery' ? 'text-primary' : ''} />
              <span>1,000+ Curated Library</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-primary/20 text-primary font-bold ml-0.5">
                {taxonomy?.total_prompts || '1003'}
              </span>
            </button>
          </div>

          {/* Close Tray Button */}
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted shrink-0 min-w-[34px] min-h-[34px] flex items-center justify-center transition-colors active:scale-95"
            title="Close Prompt Library"
            aria-label="Close Prompt Library"
          >
            <X size={16} />
          </button>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            MODE A: MODIFIER CHIPS (ORIGINAL WORKFLOW)
        ══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'chips' && (
          <div className="space-y-2.5">
            {/* Category Selector */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scrollbar-none py-0.5 pr-2">
              <span className="text-[11px] font-semibold tracking-wide uppercase text-muted-foreground flex items-center gap-1 shrink-0 mr-1">
                Categories:
              </span>
              {Object.keys(chipCategoryLabels).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveChipCategory(cat)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all shrink-0 min-h-[30px] flex items-center ${
                    activeChipCategory === cat
                      ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                      : 'bg-muted/80 text-muted-foreground hover:text-foreground hover:bg-muted active:scale-95'
                  }`}
                >
                  {chipCategoryLabels[cat]}
                </button>
              ))}
            </div>

            {/* Chips List */}
            <div className="flex flex-wrap items-center gap-1.5 max-h-36 overflow-y-auto pr-1">
              {activeChipCategory !== 'custom' &&
                chipsData?.standard?.[activeChipCategory]?.map((modifier) => (
                  <button
                    key={modifier}
                    type="button"
                    onClick={() => onInsertModifier(modifier)}
                    className="px-3 py-1.5 rounded-full text-xs font-mono bg-muted/60 hover:bg-muted border border-border text-foreground hover:border-primary/50 hover:text-primary transition-colors shadow-2xs active:scale-95 min-h-[32px] flex items-center"
                  >
                    + {modifier}
                  </button>
                ))}

              {activeChipCategory === 'custom' && (
                <>
                  {chipsData?.custom?.map((chip) => (
                    <div
                      key={chip.id}
                      onClick={() => onInsertModifier(chip.text)}
                      className="group flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono bg-muted/60 hover:bg-muted border border-border text-foreground hover:border-primary/50 cursor-pointer shadow-2xs transition-colors min-h-[32px]"
                    >
                      <span>+ {chip.text}</span>
                      <button
                        type="button"
                        onClick={(e) => handleDeleteCustom(chip.id, e)}
                        className="opacity-70 group-hover:opacity-100 text-muted-foreground hover:text-rose-500 p-0.5 rounded transition-opacity"
                        title="Delete preset"
                        aria-label="Delete preset"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}

                  {isAddingChip ? (
                    <form onSubmit={handleAddCustom} className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={newChipText}
                        onChange={(e) => setNewChipText(e.target.value)}
                        placeholder="E.g. anamorphic lens, 8k"
                        className="px-3 py-1.5 rounded-full text-[16px] sm:text-xs bg-muted border border-primary text-foreground outline-none w-48 min-h-[32px]"
                        autoFocus
                      />
                      <button
                        type="submit"
                        className="px-3 py-1.5 rounded-full text-xs font-semibold bg-primary text-primary-foreground hover:bg-emerald-600 transition-colors min-h-[32px] active:scale-95"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsAddingChip(false)}
                        className="text-muted-foreground hover:text-foreground p-1 min-w-[28px] min-h-[28px] flex items-center justify-center"
                        aria-label="Cancel"
                      >
                        <X size={14} />
                      </button>
                    </form>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsAddingChip(true)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium text-primary bg-primary/10 border border-primary/25 hover:bg-primary/20 transition-colors min-h-[32px] active:scale-95"
                    >
                      <Plus size={13} /> Add Custom
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            MODE B: 1,003 CURATED PROMPT GALLERY
        ══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'gallery' && (
          <div className="space-y-3">
            {/* ── Inspection Detail Overlay (When a card is clicked) ── */}
            {inspectPrompt ? (
              <div className="space-y-3 animate-in fade-in duration-200">
                <div className="flex items-center justify-between pb-1 border-b border-border/50">
                  <button
                    type="button"
                    onClick={() => setInspectPrompt(null)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline min-h-[34px] px-1"
                  >
                    <ArrowLeft size={14} />
                    <span>Back to Gallery</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-muted-foreground">
                      #{inspectPrompt.id} • {inspectPrompt.category}
                    </span>
                    {inspectPrompt.sourceUrl && (
                      <a
                        href={inspectPrompt.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 min-h-[30px]"
                        title="View original source"
                      >
                        <ExternalLink size={12} />
                      </a>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 items-start">
                  {/* Left: Full Resolution Image Box with Zoom */}
                  <div
                    onClick={() => setIsLightboxOpen(true)}
                    className="md:col-span-4 rounded-xl overflow-hidden border border-border bg-muted/30 aspect-4/3 relative group cursor-zoom-in shadow-xs hover:border-primary/50 transition-all"
                    title="Click to view full high-resolution image"
                  >
                    <img
                      src={inspectPrompt.full_image || inspectPrompt.thumbnail}
                      alt={inspectPrompt.title}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      onError={(e) => {
                        // Fallback to local thumbnail if raw CDN has network glitch
                        (e.target as HTMLImageElement).src = inspectPrompt.thumbnail;
                      }}
                    />
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                      <span className="px-2.5 py-1 rounded-lg bg-black/80 text-white text-[10.5px] font-semibold flex items-center gap-1 shadow-md backdrop-blur-xs">
                        <Maximize2 size={12} />
                        <span>View Full Artwork</span>
                      </span>
                    </div>
                    <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between pointer-events-none">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-black/70 text-white backdrop-blur-xs font-bold">
                        {inspectPrompt.source === 'freestylefly' ? 'freestylefly (32k★)' : 'EvoLinkAI (17k★)'}
                      </span>
                      <span className="px-1.5 py-0.5 rounded-md text-[9px] font-mono uppercase bg-emerald-600/90 text-white font-bold backdrop-blur-xs shadow-xs">
                        Full Res
                      </span>
                    </div>
                  </div>

                  {/* Right: Full Details & Prompt */}
                  <div className="md:col-span-8 space-y-2.5">
                    <div>
                      <h3 className="text-sm font-bold text-foreground">{inspectPrompt.title}</h3>
                      {inspectPrompt.sourceLabel && (
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          By <span className="font-medium text-foreground">{inspectPrompt.sourceLabel}</span>
                        </p>
                      )}
                    </div>

                    {/* Verbatim Prompt Box */}
                    <div className="relative rounded-xl border border-border bg-muted/40 p-3 max-h-48 overflow-y-auto select-text">
                      <p className="text-xs text-foreground font-sans leading-relaxed whitespace-pre-wrap">
                        {inspectPrompt.prompt}
                      </p>
                    </div>

                    {/* Style Tags */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {inspectPrompt.styles?.map((s) => (
                        <span
                          key={s}
                          className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-muted text-muted-foreground border border-border"
                        >
                          #{s}
                        </span>
                      ))}
                      {inspectPrompt.scenes?.map((sc) => (
                        <span
                          key={sc}
                          className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-muted text-muted-foreground border border-border"
                        >
                          @{sc}
                        </span>
                      ))}
                    </div>

                    {/* Action Buttons Bar */}
                    <div className="flex items-center gap-2 pt-1 flex-wrap">
                      <button
                        type="button"
                        onClick={() => handleUsePrompt(inspectPrompt, false)}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-primary hover:bg-emerald-600 text-primary-foreground shadow-md transition-all active:scale-95 min-h-[36px]"
                      >
                        <Sparkles size={14} />
                        <span>Use Prompt Verbatim</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleUsePrompt(inspectPrompt, true)}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-muted hover:bg-muted/80 text-foreground border border-border shadow-2xs transition-all active:scale-95 min-h-[36px]"
                        title="Insert prompt and apply photographic enhancer wand"
                      >
                        <Wand2 size={14} className="text-primary" />
                        <span>Use + Enhance</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleCopyInspect}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-muted/60 hover:bg-muted text-foreground border border-border transition-all active:scale-95 min-h-[36px]"
                      >
                        {copiedInspect ? (
                          <>
                            <Check size={14} className="text-emerald-500" />
                            <span className="text-emerald-500 font-semibold">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy size={14} />
                            <span>Copy Prompt</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* ── Main Gallery Browsing View ── */
              <div className="space-y-2.5">
                {/* Search Bar & Sub-Filters Toggle */}
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search
                      size={14}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                    />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search 1,000+ prompts (e.g. watercolor, neon, product, macro)..."
                      className="w-full pl-9 pr-8 py-1.5 rounded-xl bg-muted/70 border border-border text-[16px] sm:text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary transition-colors min-h-[36px]"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>

                  {/* Filter Toggle Button */}
                  <button
                    type="button"
                    onClick={() => setShowStyleFilter(!showStyleFilter)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all min-h-[36px] ${
                      showStyleFilter || selectedStyle !== 'all' || selectedSource !== 'all'
                        ? 'bg-primary/10 text-primary border-primary/30'
                        : 'bg-muted/70 text-muted-foreground hover:text-foreground border-border'
                    }`}
                  >
                    <Filter size={13} />
                    <span className="hidden sm:inline">Styles</span>
                    {(selectedStyle !== 'all' || selectedSource !== 'all') && (
                      <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                    )}
                  </button>
                </div>

                {/* ── Categories Pill Bar (Horizontal Scroll) ── */}
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scrollbar-none py-1">
                  <button
                    type="button"
                    onClick={() => setSelectedCategory('all')}
                    className={`px-2.5 py-1 rounded-xl text-xs font-semibold shrink-0 transition-all min-h-[30px] flex items-center gap-1 ${
                      selectedCategory === 'all'
                        ? 'bg-foreground text-background shadow-xs'
                        : 'bg-muted/80 text-muted-foreground hover:text-foreground hover:bg-muted active:scale-95'
                    }`}
                  >
                    <span>All</span>
                    <span className="text-[10px] opacity-70 font-mono">({taxonomy?.total_prompts || 1003})</span>
                  </button>

                  {taxonomy?.categories?.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setSelectedCategory(cat.title)}
                      className={`px-2.5 py-1 rounded-xl text-xs font-medium shrink-0 transition-all min-h-[30px] flex items-center gap-1.5 ${
                        selectedCategory === cat.title
                          ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                          : 'bg-muted/80 text-muted-foreground hover:text-foreground hover:bg-muted active:scale-95'
                      }`}
                    >
                      <span>{cat.icon}</span>
                      <span>{cat.title}</span>
                      <span className="text-[10px] font-mono opacity-70">({cat.count})</span>
                    </button>
                  ))}
                </div>

                {/* ── Sub-Filters Row (Styles & Sources) ── */}
                {showStyleFilter && (
                  <div className="p-2.5 rounded-xl bg-muted/40 border border-border/60 space-y-2 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between">
                      <span className="text-[10.5px] uppercase font-bold text-muted-foreground tracking-wider">
                        Popular Styles:
                      </span>
                      {(selectedStyle !== 'all' || selectedSource !== 'all') && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedStyle('all');
                            setSelectedSource('all');
                          }}
                          className="text-[11px] text-primary hover:underline font-mono"
                        >
                          Reset Filters
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scrollbar-none pb-1">
                      <button
                        type="button"
                        onClick={() => setSelectedStyle('all')}
                        className={`px-2 py-0.5 rounded-lg text-xs font-medium shrink-0 ${
                          selectedStyle === 'all'
                            ? 'bg-primary text-primary-foreground font-semibold'
                            : 'bg-card text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        All Styles
                      </button>
                      {taxonomy?.styles?.slice(0, 10).map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setSelectedStyle(s.value)}
                          className={`px-2 py-0.5 rounded-lg text-xs font-medium shrink-0 transition-all ${
                            selectedStyle === s.value
                              ? 'bg-primary text-primary-foreground font-semibold'
                              : 'bg-card text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          {s.title} ({s.count})
                        </button>
                      ))}
                    </div>

                    {/* Source Selector */}
                    <div className="flex items-center gap-2 pt-1 border-t border-border/40 text-[11px]">
                      <span className="text-muted-foreground font-semibold">Source:</span>
                      <button
                        type="button"
                        onClick={() => setSelectedSource('all')}
                        className={`px-2 py-0.5 rounded ${
                          selectedSource === 'all' ? 'font-bold text-primary underline' : 'text-muted-foreground'
                        }`}
                      >
                        All (1,003)
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedSource('freestylefly')}
                        className={`px-2 py-0.5 rounded ${
                          selectedSource === 'freestylefly' ? 'font-bold text-primary underline' : 'text-muted-foreground'
                        }`}
                      >
                        freestylefly (541)
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedSource('evolinkai')}
                        className={`px-2 py-0.5 rounded ${
                          selectedSource === 'evolinkai' ? 'font-bold text-primary underline' : 'text-muted-foreground'
                        }`}
                      >
                        EvoLinkAI (462)
                      </button>
                    </div>
                  </div>
                )}

                {/* ── Prompts Grid / Loading / Empty State ── */}
                {isLoading ? (
                  <div className="py-12 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                    <Loader2 size={24} className="animate-spin text-primary" />
                    <span className="text-xs font-mono">Loading curated prompts...</span>
                  </div>
                ) : prompts.length === 0 ? (
                  <div className="py-10 text-center space-y-2">
                    <p className="text-xs text-muted-foreground">
                      No prompts matched your filters or search query &quot;{searchQuery}&quot;.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setSelectedCategory('all');
                        setSelectedStyle('all');
                        setSelectedSource('all');
                      }}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground inline-block"
                    >
                      Clear All Filters
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Prompt Cards Grid (Max height scroll container) */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 max-h-[52vh] sm:max-h-[58vh] overflow-y-auto pr-1">
                      {prompts.map((p) => (
                        <PromptCard
                          key={`${p.source}-${p.id}`}
                          prompt={p}
                          onSelect={(card) => setInspectPrompt(card)}
                          onUse={(card, enhance) => handleUsePrompt(card, enhance)}
                          onTagClick={(tag, type) => {
                            if (type === 'style') setSelectedStyle(tag);
                            if (type === 'scene') setSelectedScene(tag);
                          }}
                        />
                      ))}
                    </div>

                    {/* Footer: Count & Load More */}
                    <div className="flex items-center justify-between pt-1 border-t border-border/40 text-xs text-muted-foreground">
                      <span className="font-mono text-[11px]">
                        Showing {prompts.length} of {totalCount} prompts
                      </span>

                      {page < totalPages && (
                        <button
                          type="button"
                          onClick={handleLoadMore}
                          disabled={isLoadingMore}
                          className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-muted/80 hover:bg-muted text-foreground text-xs font-semibold border border-border active:scale-95 transition-all min-h-[30px]"
                        >
                          {isLoadingMore ? (
                            <>
                              <Loader2 size={12} className="animate-spin text-primary" />
                              <span>Loading...</span>
                            </>
                          ) : (
                            <>
                              <span>Load More</span>
                              <ChevronDown size={13} />
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── High-Resolution Lightbox Modal (Full Artwork Inspector) ── */}
      {isLightboxOpen && inspectPrompt && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-md flex flex-col items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200"
          onClick={() => setIsLightboxOpen(false)}
        >
          <div
            className="absolute top-4 right-4 flex items-center gap-2 z-10"
            onClick={(e) => e.stopPropagation()}
          >
            {inspectPrompt.full_image && (
              <a
                href={inspectPrompt.full_image}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-medium flex items-center gap-1.5 backdrop-blur-md transition-colors min-h-[36px]"
                title="Open raw image in new tab"
              >
                <ExternalLink size={13} />
                <span>Open Raw ↗</span>
              </a>
            )}
            <button
              type="button"
              onClick={() => setIsLightboxOpen(false)}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center cursor-pointer"
              title="Close Full Artwork (Esc)"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>

          <div
            className="relative max-w-5xl max-h-[85vh] flex flex-col items-center select-none"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={inspectPrompt.full_image || inspectPrompt.thumbnail}
              alt={inspectPrompt.title}
              className="max-w-full max-h-[80vh] object-contain rounded-xl shadow-2xl border border-white/10"
            />
            <div className="mt-3 text-center px-4">
              <h4 className="text-white text-sm font-semibold">{inspectPrompt.title}</h4>
              <p className="text-white/60 text-xs mt-0.5 font-mono">
                {inspectPrompt.category} • Full Resolution Artwork
              </p>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
