import { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Lock,
  Unlock,
  UserCircle2,
  Shirt,
  Sparkles,
  Trash2,
  ExternalLink,
  Maximize2,
  Check,
  Camera,
  Copy,
  Code2,
  AlertCircle,
  UploadCloud,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { CharacterCard } from '../../types';
import { api, copyToClipboard } from '../../lib/api';
import { hapticImpact } from '../../lib/haptics';
import {
  CanonicalPhysicalIdentity,
  buildCanonicalCharacterLock,
  extractPhysicalIdentityFromCharacter,
  parseCharacterLockJsonSafe,
  createDefaultPhysicalIdentity,
} from '../../lib/characterLock';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  activeCharacter: CharacterCard | null;
  setActiveCharacter: (char: CharacterCard | null) => void;
  onNavigateToGenerator?: () => void;
}

/**
 * Universal image URL resolver for character cards and avatars.
 * Handles bare timestamps (e.g. 1789501984885), filenames with .png, and full paths.
 */
export const resolveImageUrl = (imgId?: string | null): string | null => {
  if (!imgId) return null;
  const clean = imgId.trim();
  if (!clean) return null;
  if (clean.startsWith('http://') || clean.startsWith('https://') || clean.startsWith('data:')) {
    return clean;
  }
  if (clean.startsWith('/images/')) {
    return clean;
  }
  if (clean.startsWith('images/')) {
    return `/${clean}`;
  }
  const filename = clean.replace(/^\/+/, '');
  const withExt =
    filename.endsWith('.png') || filename.endsWith('.webp') || filename.endsWith('.jpg')
      ? filename
      : `${filename}.png`;
  return `/images/${withExt}`;
};

/**
 * Extract best available avatar photo for a character.
 */
export const getCharacterAvatar = (char: Partial<CharacterCard>): string | null => {
  return (
    resolveImageUrl(char.avatar_image_id) ||
    resolveImageUrl(char.face_lock_image_id) ||
    resolveImageUrl(char.character_lock?.cards?.face) ||
    resolveImageUrl(char.body_lock_image_id) ||
    resolveImageUrl(char.character_lock?.cards?.body) ||
    null
  );
};

/**
 * Extract all 3 structured reference cards for a character.
 */
export const getCharacterCards = (char: Partial<CharacterCard>) => {
  const face =
    resolveImageUrl(char.face_lock_image_id) ||
    resolveImageUrl(char.character_lock?.cards?.face) ||
    (char.avatar_image_id ? resolveImageUrl(char.avatar_image_id) : null);
  const body =
    resolveImageUrl(char.body_lock_image_id) ||
    resolveImageUrl(char.character_lock?.cards?.body);
  const expression =
    resolveImageUrl(char.expression_lock_image_id) ||
    resolveImageUrl(char.character_lock?.cards?.expression);
  return { face, body, expression };
};

export function CharacterStudioDrawer({
  isOpen,
  onClose,
  activeCharacter,
  setActiveCharacter,
  onNavigateToGenerator,
}: Props) {
  const [characters, setCharacters] = useState<CharacterCard[]>([]);
  const [editingChar, setEditingChar] = useState<Partial<CharacterCard> | null>(null);
  const [loading, setLoading] = useState(false);
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);

  // Canonical Physical Identity & Character Lock state
  const [physicalId, setPhysicalId] = useState<CanonicalPhysicalIdentity>(() => createDefaultPhysicalIdentity());
  const [lockRule, setLockRule] = useState<string>('');
  const [specTab, setSpecTab] = useState<'fields' | 'json'>('fields');
  const [jsonText, setJsonText] = useState<string>('');
  const [copiedJson, setCopiedJson] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [rawImportInput, setRawImportInput] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [showWardrobes, setShowWardrobes] = useState(false);

  useEffect(() => {
    if (editingChar) {
      const { identity, lockRule: extractedRule } = extractPhysicalIdentityFromCharacter(editingChar);
      setPhysicalId(identity);
      setLockRule(extractedRule);
      const canonical = buildCanonicalCharacterLock(
        editingChar.name || 'Character',
        identity,
        extractedRule
      );
      setJsonText(JSON.stringify(canonical, null, 2));
    }
  }, [editingChar?.id]);

  const updatePhysicalField = (
    section: keyof CanonicalPhysicalIdentity,
    field: string,
    value: string
  ) => {
    setPhysicalId((prev) => {
      const updated = {
        ...prev,
        [section]: {
          ...(prev[section] as any),
          [field]: value,
        },
      };
      const canonical = buildCanonicalCharacterLock(
        editingChar?.name || 'Character',
        updated,
        lockRule
      );
      setJsonText(JSON.stringify(canonical, null, 2));
      return updated;
    });
  };

  const updateLockRule = (newRule: string) => {
    setLockRule(newRule);
    const canonical = buildCanonicalCharacterLock(
      editingChar?.name || 'Character',
      physicalId,
      newRule
    );
    setJsonText(JSON.stringify(canonical, null, 2));
  };

  const handleClose = () => {
    hapticImpact('light');
    onClose();
  };

  const handleApplyImportedJson = () => {
    const result = parseCharacterLockJsonSafe(rawImportInput, editingChar?.name || 'Character');
    if (!result.ok) {
      setImportError(result.error);
      return;
    }
    hapticImpact('medium');
    setPhysicalId(result.data.physical_identity);
    setLockRule(result.data.lock_rule);
    setJsonText(JSON.stringify(result.data, null, 2));
    setIsImportModalOpen(false);
    setRawImportInput('');
    setImportError(null);
  };

  const handleCopyJson = async () => {
    hapticImpact('light');
    await copyToClipboard(jsonText);
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  useEffect(() => {
    if (isOpen) {
      loadCharacters();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (previewImage) {
          setPreviewImage(null);
        } else if (isImportModalOpen) {
          setIsImportModalOpen(false);
        } else {
          handleClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, previewImage, isImportModalOpen]);

  const loadCharacters = async () => {
    try {
      const data = await api.getCharacters();
      setCharacters(data);
    } catch (err) {
      console.error('Failed to load characters', err);
    }
  };

  const handleSave = async () => {
    if (!editingChar?.name) return;
    hapticImpact('medium');
    setLoading(true);
    try {
      const canonicalLock = buildCanonicalCharacterLock(
        editingChar.name,
        physicalId,
        lockRule
      );
      const visualDna = `${physicalId.face.shape || 'feminine face'}, ${physicalId.face.eyes || 'expressive eyes'}, ${physicalId.skin.tone || 'natural skin'}, ${physicalId.hair.color || 'natural hair'}. Body: ${physicalId.body.silhouette || 'natural silhouette'}, ${physicalId.body.build || 'natural build'}.`;

      const toSave: Partial<CharacterCard> = {
        ...editingChar,
        visual_dna: visualDna,
        character_lock: canonicalLock,
      };

      const saved = await api.saveCharacter(toSave);
      setEditingChar(saved);
      if (activeCharacter?.id === saved.id) {
        setActiveCharacter(saved);
      }
      await loadCharacters();
    } catch (err) {
      console.error('Failed to save character', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (charId: string, charName: string) => {
    if (!confirm(`Are you sure you want to delete character "${charName}"? This cannot be undone.`)) {
      return;
    }
    hapticImpact('heavy');
    try {
      await api.deleteCharacter(charId);
      if (activeCharacter?.id === charId) {
        setActiveCharacter(null);
      }
      if (editingChar?.id === charId) {
        setEditingChar(null);
      }
      await loadCharacters();
    } catch (err) {
      console.error('Failed to delete character', err);
      alert('Delete failed');
    }
  };

  const handleLockToggle = async (char: CharacterCard) => {
    hapticImpact('medium');
    try {
      const newState = !char.is_locked;
      const res = await api.lockCharacter(char.id, newState);
      const updated = { ...char, is_locked: res.locked };
      if (editingChar?.id === char.id) setEditingChar(updated);
      if (activeCharacter?.id === char.id || newState) {
        setActiveCharacter(newState ? updated : null);
      }
      await loadCharacters();
    } catch (err) {
      console.error(err);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm transition-opacity"
      onClick={handleClose}
    >
      <div
        className="w-full max-w-lg h-full bg-card text-card-foreground shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-200 border-l border-border"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <UserCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-foreground">
                Character Studio
              </h2>
              <p className="text-[11px] text-muted-foreground">
                {characters.length} character{characters.length === 1 ? '' : 's'} saved · Identity & reference cards
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="min-w-[44px] min-h-[44px] p-2 hover:bg-muted text-muted-foreground hover:text-foreground rounded-xl transition-colors flex items-center justify-center active:scale-95"
            aria-label="Close Character Studio"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
          {!editingChar ? (
            /* ── CHARACTER LIST VIEW ── */
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  onClick={() => {
                    hapticImpact('light');
                    setEditingChar({
                      name: '',
                      tagline: '',
                      visual_dna: '',
                      persona: '',
                      wardrobes: [],
                    });
                  }}
                  className="w-full min-h-[44px] h-11 py-2.5 px-3.5 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold text-xs shadow-xs transition-all active:scale-[0.98]"
                >
                  <Plus className="w-4 h-4" /> New Character
                </button>
                {onNavigateToGenerator && (
                  <button
                    onClick={() => {
                      hapticImpact('light');
                      onNavigateToGenerator();
                    }}
                    className="w-full min-h-[44px] h-11 py-2.5 px-3.5 flex items-center justify-center gap-2 bg-muted hover:bg-muted/80 text-foreground rounded-xl font-semibold text-xs border border-border transition-all active:scale-[0.98]"
                  >
                    <Sparkles className="w-4 h-4 text-emerald-500" /> Reference Studio
                  </button>
                )}
              </div>

              {characters.length === 0 ? (
                <div className="p-8 text-center border border-dashed border-border rounded-2xl space-y-3 bg-muted/20">
                  <UserCircle2 className="w-10 h-10 text-muted-foreground/60 mx-auto" />
                  <div className="text-sm font-semibold text-foreground">
                    No characters created yet
                  </div>
                  <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                    Generate full 3-step Face, Body, and Expression cards in Reference Studio to save your first character.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {characters.map((char) => {
                    const avatarUrl = getCharacterAvatar(char);
                    const cards = getCharacterCards(char);
                    const hasAnyCards = Boolean(cards.face || cards.body || cards.expression);

                    return (
                      <div
                        key={char.id}
                        className="p-3.5 sm:p-4 rounded-2xl border border-border bg-card hover:border-emerald-500/40 transition-all flex flex-col gap-3 shadow-2xs group"
                      >
                        {/* Top: Avatar + Info + Primary Action */}
                        <div className="flex items-start gap-3 justify-between">
                          {/* Avatar with image or initials */}
                          <div
                            onClick={() => {
                              if (avatarUrl) {
                                hapticImpact('light');
                                setPreviewImage({
                                  url: avatarUrl,
                                  title: `${char.name} — Avatar Reference`,
                                });
                              }
                            }}
                            className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden border border-border bg-muted shrink-0 cursor-pointer shadow-2xs group/avatar active:scale-95 transition-transform"
                            title={avatarUrl ? 'Click to inspect photo' : char.name}
                          >
                            {avatarUrl ? (
                              <>
                                <img
                                  src={avatarUrl}
                                  alt={char.name}
                                  className="w-full h-full object-cover object-top group-hover/avatar:scale-105 transition-transform"
                                  onError={(e) => {
                                    // Fallback to initial if image fails
                                    (e.target as HTMLElement).style.display = 'none';
                                  }}
                                />
                                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/avatar:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                                  <Maximize2 className="w-4 h-4 text-white drop-shadow" />
                                </div>
                              </>
                            ) : (
                              <div className="w-full h-full flex items-center justify-center font-bold text-lg text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 font-mono">
                                {char.name?.slice(0, 2).toUpperCase() || 'CH'}
                              </div>
                            )}

                            {char.is_locked && (
                              <div className="absolute top-1 left-1 bg-emerald-600 text-white p-0.5 rounded-md shadow-xs" title="Active Lock">
                                <Lock className="w-2.5 h-2.5" />
                              </div>
                            )}
                          </div>

                          {/* Info Column */}
                          <div className="flex-1 min-w-0 pr-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-sm sm:text-base text-foreground truncate">
                                {char.name}
                              </span>
                              {char.is_locked && (
                                <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 rounded-md border border-emerald-500/30">
                                  Active Lock
                                </span>
                              )}
                            </div>

                            {char.tagline && (
                              <div className="text-[11px] text-muted-foreground font-medium truncate mt-0.5">
                                {char.tagline}
                              </div>
                            )}

                            <div className="text-[11px] text-muted-foreground line-clamp-2 mt-1 leading-relaxed">
                              {char.visual_dna}
                            </div>
                          </div>

                          {/* Actions with Apple HIG touch targets */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              onClick={() => handleLockToggle(char)}
                              className={`min-w-[44px] min-h-[44px] p-2.5 rounded-xl transition-all active:scale-95 flex items-center justify-center ${
                                char.is_locked
                                  ? 'bg-emerald-600 text-white shadow-xs'
                                  : 'bg-muted hover:bg-muted/80 text-foreground border border-border'
                              }`}
                              title={
                                char.is_locked
                                  ? 'Identity Locked: click to unlock'
                                  : 'Click to lock as Active Character'
                              }
                              aria-label={char.is_locked ? `Unlock ${char.name}` : `Lock ${char.name}`}
                            >
                              {char.is_locked ? (
                                <Lock className="w-4 h-4" />
                              ) : (
                                <Unlock className="w-4 h-4" />
                              )}
                            </button>
                            <button
                              onClick={() => {
                                hapticImpact('selection');
                                setEditingChar(char);
                              }}
                              className="min-h-[44px] px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-all active:scale-95 flex items-center justify-center"
                              aria-label={`Edit ${char.name}`}
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDelete(char.id, char.name)}
                              className="min-w-[44px] min-h-[44px] p-2.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl transition-colors flex items-center justify-center active:scale-95"
                              title="Delete Character"
                              aria-label={`Delete ${char.name}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Bottom: Reference Cards Thumbnails Strip */}
                        {hasAnyCards && (
                          <div className="pt-2.5 border-t border-border flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium">
                              <Camera className="w-3.5 h-3.5 text-emerald-500" />
                              <span>Cards:</span>
                            </div>

                            <div className="flex items-center gap-2">
                              {cards.face && (
                                <button
                                  onClick={() => {
                                    hapticImpact('light');
                                    setPreviewImage({
                                      url: cards.face!,
                                      title: `${char.name} — Face Identity Card`,
                                    });
                                  }}
                                  className="group/thumb relative w-12 h-8 rounded-lg overflow-hidden border border-border bg-black/10 hover:border-emerald-500 transition-all shrink-0 active:scale-95 shadow-2xs"
                                  title="Face Identity Card (Click to preview)"
                                  aria-label="Preview Face Identity Card"
                                >
                                  <img
                                    src={cards.face}
                                    alt="Face Card"
                                    className="w-full h-full object-cover group-hover/thumb:scale-110 transition-transform"
                                  />
                                  <span className="absolute bottom-0 right-0 bg-emerald-600 text-white text-[8.5px] font-mono px-1 py-0.5 leading-none rounded-tl">
                                    F
                                  </span>
                                </button>
                              )}

                              {cards.body && (
                                <button
                                  onClick={() => {
                                    hapticImpact('light');
                                    setPreviewImage({
                                      url: cards.body!,
                                      title: `${char.name} — Body Turnaround Card`,
                                    });
                                  }}
                                  className="group/thumb relative w-12 h-8 rounded-lg overflow-hidden border border-border bg-black/10 hover:border-emerald-500 transition-all shrink-0 active:scale-95 shadow-2xs"
                                  title="Body Turnaround Card (Click to preview)"
                                  aria-label="Preview Body Turnaround Card"
                                >
                                  <img
                                    src={cards.body}
                                    alt="Body Card"
                                    className="w-full h-full object-cover group-hover/thumb:scale-110 transition-transform"
                                  />
                                  <span className="absolute bottom-0 right-0 bg-emerald-600 text-white text-[8.5px] font-mono px-1 py-0.5 leading-none rounded-tl">
                                    B
                                  </span>
                                </button>
                              )}

                              {cards.expression && (
                                <button
                                  onClick={() => {
                                    hapticImpact('light');
                                    setPreviewImage({
                                      url: cards.expression!,
                                      title: `${char.name} — Expression Sheet Card`,
                                    });
                                  }}
                                  className="group/thumb relative w-12 h-8 rounded-lg overflow-hidden border border-border bg-black/10 hover:border-emerald-500 transition-all shrink-0 active:scale-95 shadow-2xs"
                                  title="Expression Sheet Card (Click to preview)"
                                  aria-label="Preview Expression Sheet Card"
                                >
                                  <img
                                    src={cards.expression}
                                    alt="Expression Card"
                                    className="w-full h-full object-cover group-hover/thumb:scale-110 transition-transform"
                                  />
                                  <span className="absolute bottom-0 right-0 bg-emerald-600 text-white text-[8.5px] font-mono px-1 py-0.5 leading-none rounded-tl">
                                    E
                                  </span>
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* ── CHARACTER EDIT & VIEW MODE ── */
            <div className="space-y-5 animate-in fade-in duration-150">
              <button
                onClick={() => {
                  hapticImpact('selection');
                  setEditingChar(null);
                }}
                className="min-h-[44px] px-2 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 font-medium transition-colors active:scale-95"
              >
                ← Back to Characters
              </button>

              {/* Header Title + Lock Status */}
              <div className="flex justify-between items-center gap-2">
                <div>
                  <h3 className="font-bold text-lg text-foreground">
                    {editingChar.id ? `Edit ${editingChar.name || 'Character'}` : 'New Character'}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {editingChar.tagline || 'Visual DNA & Identity Reference'}
                  </p>
                </div>
                {editingChar.id && (
                  <button
                    onClick={() => handleLockToggle(editingChar as CharacterCard)}
                    className={`min-h-[44px] px-3.5 py-2 flex items-center gap-2 rounded-xl font-semibold text-xs transition-all active:scale-95 shrink-0 ${
                      editingChar.is_locked
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-muted hover:bg-muted/80 text-foreground border border-border'
                    }`}
                  >
                    {editingChar.is_locked ? (
                      <>
                        <Lock className="w-4 h-4" />
                        <span>Locked Active</span>
                      </>
                    ) : (
                      <>
                        <Unlock className="w-4 h-4" />
                        <span>Lock Character</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* ── VISUAL REFERENCE CARDS GALLERY SECTION ── */}
              {(() => {
                const cards = getCharacterCards(editingChar);
                return (
                  <div className="space-y-2.5 p-3.5 sm:p-4 rounded-2xl bg-muted/40 border border-border">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Identity Reference Cards & Visual Locks</span>
                      </label>
                      {onNavigateToGenerator && (
                        <button
                          onClick={() => {
                            hapticImpact('light');
                            onNavigateToGenerator();
                          }}
                          className="min-h-[36px] px-2 text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline font-medium flex items-center gap-1"
                        >
                          <span>Studio Generator</span>
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-2.5 pt-1">
                      {/* Face Reference Card */}
                      <div className="space-y-1.5">
                        <div
                          onClick={() => {
                            if (cards.face) {
                              hapticImpact('light');
                              setPreviewImage({
                                url: cards.face,
                                title: `${editingChar.name || 'Character'} — Face Card`,
                              });
                            }
                          }}
                          className={`aspect-[4/3] rounded-xl overflow-hidden border relative flex items-center justify-center transition-all ${
                            cards.face
                              ? 'border-border bg-black/10 cursor-pointer group hover:border-emerald-500 active:scale-95 shadow-2xs'
                              : 'border-dashed border-border bg-muted/30'
                          }`}
                        >
                          {cards.face ? (
                            <>
                              <img
                                src={cards.face}
                                alt="Face Card"
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                              />
                              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                                <Maximize2 className="w-4 h-4 text-white drop-shadow" />
                              </div>
                              <span className="absolute top-1 left-1 bg-emerald-600 text-white text-[9px] font-semibold px-1.5 py-0.5 rounded shadow-xs">
                                Face ✓
                              </span>
                            </>
                          ) : (
                            <span className="text-[10px] text-muted-foreground text-center px-1">
                              No Face Card
                            </span>
                          )}
                        </div>
                        <div className="text-[10.5px] text-center font-medium text-muted-foreground">
                          Face Identity
                        </div>
                      </div>

                      {/* Body Reference Card */}
                      <div className="space-y-1.5">
                        <div
                          onClick={() => {
                            if (cards.body) {
                              hapticImpact('light');
                              setPreviewImage({
                                url: cards.body,
                                title: `${editingChar.name || 'Character'} — Body Card`,
                              });
                            }
                          }}
                          className={`aspect-[4/3] rounded-xl overflow-hidden border relative flex items-center justify-center transition-all ${
                            cards.body
                              ? 'border-border bg-black/10 cursor-pointer group hover:border-emerald-500 active:scale-95 shadow-2xs'
                              : 'border-dashed border-border bg-muted/30'
                          }`}
                        >
                          {cards.body ? (
                            <>
                              <img
                                src={cards.body}
                                alt="Body Card"
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                              />
                              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                                <Maximize2 className="w-4 h-4 text-white drop-shadow" />
                              </div>
                              <span className="absolute top-1 left-1 bg-emerald-600 text-white text-[9px] font-semibold px-1.5 py-0.5 rounded shadow-xs">
                                Body ✓
                              </span>
                            </>
                          ) : (
                            <span className="text-[10px] text-muted-foreground text-center px-1">
                              No Body Card
                            </span>
                          )}
                        </div>
                        <div className="text-[10.5px] text-center font-medium text-muted-foreground">
                          Body Turnaround
                        </div>
                      </div>

                      {/* Expression Reference Card */}
                      <div className="space-y-1.5">
                        <div
                          onClick={() => {
                            if (cards.expression) {
                              hapticImpact('light');
                              setPreviewImage({
                                url: cards.expression,
                                title: `${editingChar.name || 'Character'} — Expression Card`,
                              });
                            }
                          }}
                          className={`aspect-[4/3] rounded-xl overflow-hidden border relative flex items-center justify-center transition-all ${
                            cards.expression
                              ? 'border-border bg-black/10 cursor-pointer group hover:border-emerald-500 active:scale-95 shadow-2xs'
                              : 'border-dashed border-border bg-muted/30'
                          }`}
                        >
                          {cards.expression ? (
                            <>
                              <img
                                src={cards.expression}
                                alt="Expression Card"
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                              />
                              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                                <Maximize2 className="w-4 h-4 text-white drop-shadow" />
                              </div>
                              <span className="absolute top-1 left-1 bg-emerald-600 text-white text-[9px] font-semibold px-1.5 py-0.5 rounded shadow-xs">
                                Expr ✓
                              </span>
                            </>
                          ) : (
                            <span className="text-[10px] text-muted-foreground text-center px-1">
                              No Expr Card
                            </span>
                          )}
                        </div>
                        <div className="text-[10.5px] text-center font-medium text-muted-foreground">
                          Expressions
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Inputs */}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Name
                </label>
                <input
                  value={editingChar.name || ''}
                  onChange={(e) => setEditingChar({ ...editingChar, name: e.target.value })}
                  className="w-full bg-background border border-border rounded-xl p-2.5 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none text-foreground"
                  placeholder="E.g., Nastya, Nia, Kaya"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Tagline / Archetype
                </label>
                <input
                  value={editingChar.tagline || ''}
                  onChange={(e) => setEditingChar({ ...editingChar, tagline: e.target.value })}
                  className="w-full bg-background border border-border rounded-xl p-2.5 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none text-foreground"
                  placeholder="E.g., Slavic Russian woman, early 20s"
                />
              </div>

              {/* ── CANONICAL PHYSICAL IDENTITY LOCK SPECIFICATION ── */}
              <div className="space-y-4 pt-1">
                {/* Header & Mode Switcher */}
                <div className="flex items-center justify-between gap-2 border-b border-border pb-2.5">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-xs font-semibold text-foreground">
                      Physical Identity Specification
                    </span>
                  </div>
                  <div className="flex items-center bg-muted p-1 rounded-xl border border-border text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        hapticImpact('selection');
                        setSpecTab('fields');
                      }}
                      className={`min-h-[36px] px-3 py-1.5 rounded-lg font-medium transition-all ${
                        specTab === 'fields'
                          ? 'bg-card text-foreground shadow-xs'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Structured Fields
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        hapticImpact('selection');
                        setSpecTab('json');
                      }}
                      className={`min-h-[36px] px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-all ${
                        specTab === 'json'
                          ? 'bg-card text-foreground shadow-xs'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <Code2 className="w-3.5 h-3.5" />
                      <span>Raw JSON</span>
                    </button>
                  </div>
                </div>

                {/* Mode A: Structured Value-Editable Fields */}
                {specTab === 'fields' ? (
                  <div className="space-y-4">
                    {/* Section 1: Face Identity Lock (Corresponds to Image 1) */}
                    <div className="p-3.5 rounded-2xl bg-muted/40 border border-border space-y-3">
                      <div className="flex items-center justify-between border-b border-border/60 pb-2">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          <span>Image 1: Face Identity Lock</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground font-mono">facial ground truth</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div className="sm:col-span-2">
                          <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                            Face Shape & Structure
                          </label>
                          <input
                            value={physicalId.face.shape}
                            onChange={(e) => updatePhysicalField('face', 'shape', e.target.value)}
                            placeholder="E.g., soft feminine face with fuller plush cheeks"
                            className="w-full bg-background border border-border rounded-xl p-2 text-xs text-foreground outline-none focus:border-emerald-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                            Eyes & Gaze
                          </label>
                          <input
                            value={physicalId.face.eyes}
                            onChange={(e) => updatePhysicalField('face', 'eyes', e.target.value)}
                            placeholder="E.g., large expressive hazel-brown eyes"
                            className="w-full bg-background border border-border rounded-xl p-2 text-xs text-foreground outline-none focus:border-emerald-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                            Eyebrows
                          </label>
                          <input
                            value={physicalId.face.brows}
                            onChange={(e) => updatePhysicalField('face', 'brows', e.target.value)}
                            placeholder="E.g., natural dark expressive brows"
                            className="w-full bg-background border border-border rounded-xl p-2 text-xs text-foreground outline-none focus:border-emerald-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                            Nose
                          </label>
                          <input
                            value={physicalId.face.nose}
                            onChange={(e) => updatePhysicalField('face', 'nose', e.target.value)}
                            placeholder="E.g., small refined natural nose"
                            className="w-full bg-background border border-border rounded-xl p-2 text-xs text-foreground outline-none focus:border-emerald-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                            Cheeks
                          </label>
                          <input
                            value={physicalId.face.cheeks}
                            onChange={(e) => updatePhysicalField('face', 'cheeks', e.target.value)}
                            placeholder="E.g., full soft cheeks"
                            className="w-full bg-background border border-border rounded-xl p-2 text-xs text-foreground outline-none focus:border-emerald-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                            Lips
                          </label>
                          <input
                            value={physicalId.face.lips}
                            onChange={(e) => updatePhysicalField('face', 'lips', e.target.value)}
                            placeholder="E.g., soft pink, plush naturally full lips"
                            className="w-full bg-background border border-border rounded-xl p-2 text-xs text-foreground outline-none focus:border-emerald-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                            Distinctive Features
                          </label>
                          <input
                            value={physicalId.face.distinctive_features}
                            onChange={(e) => updatePhysicalField('face', 'distinctive_features', e.target.value)}
                            placeholder="E.g., subtle natural beauty mark, dimples"
                            className="w-full bg-background border border-border rounded-xl p-2 text-xs text-foreground outline-none focus:border-emerald-500"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Section 2: Skin & Hair Lock (Corresponds to Image 3) */}
                    <div className="p-3.5 rounded-2xl bg-muted/40 border border-border space-y-3">
                      <div className="flex items-center justify-between border-b border-border/60 pb-2">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          <span>Image 3: Skin & Hair Realism Lock</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground font-mono">surface realism</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div className="sm:col-span-2">
                          <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                            Skin Tone & Undertone
                          </label>
                          <input
                            value={physicalId.skin.tone}
                            onChange={(e) => updatePhysicalField('skin', 'tone', e.target.value)}
                            placeholder="E.g., bright natural milky-white with soft peach-pink warmth"
                            className="w-full bg-background border border-border rounded-xl p-2 text-xs text-foreground outline-none focus:border-emerald-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                            Skin Texture & Finish
                          </label>
                          <input
                            value={physicalId.skin.texture}
                            onChange={(e) => updatePhysicalField('skin', 'texture', e.target.value)}
                            placeholder="E.g., smooth realistic human skin with subtle pores"
                            className="w-full bg-background border border-border rounded-xl p-2 text-xs text-foreground outline-none focus:border-emerald-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                            Hair Color
                          </label>
                          <input
                            value={physicalId.hair.color}
                            onChange={(e) => updatePhysicalField('hair', 'color', e.target.value)}
                            placeholder="E.g., dark brown to black"
                            className="w-full bg-background border border-border rounded-xl p-2 text-xs text-foreground outline-none focus:border-emerald-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                            Hair Length & Volume
                          </label>
                          <input
                            value={physicalId.hair.length}
                            onChange={(e) => updatePhysicalField('hair', 'length', e.target.value)}
                            placeholder="E.g., long, thick, naturally voluminous"
                            className="w-full bg-background border border-border rounded-xl p-2 text-xs text-foreground outline-none focus:border-emerald-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                            Hair Distinctive Features
                          </label>
                          <input
                            value={physicalId.hair.distinctive_features}
                            onChange={(e) => updatePhysicalField('hair', 'distinctive_features', e.target.value)}
                            placeholder="E.g., warm golden/caramel face-framing strands"
                            className="w-full bg-background border border-border rounded-xl p-2 text-xs text-foreground outline-none focus:border-emerald-500"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Section 3: Body Turnaround Lock (Corresponds to Image 2) */}
                    <div className="p-3.5 rounded-2xl bg-muted/40 border border-border space-y-3">
                      <div className="flex items-center justify-between border-b border-border/60 pb-2">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          <span>Image 2: Body Proportion Lock</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground font-mono">silhouette & build</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                            Physique & Build
                          </label>
                          <input
                            value={physicalId.body.build}
                            onChange={(e) => updatePhysicalField('body', 'build', e.target.value)}
                            placeholder="E.g., soft, dramatic feminine curvy physique"
                            className="w-full bg-background border border-border rounded-xl p-2 text-xs text-foreground outline-none focus:border-emerald-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                            Silhouette
                          </label>
                          <input
                            value={physicalId.body.silhouette}
                            onChange={(e) => updatePhysicalField('body', 'silhouette', e.target.value)}
                            placeholder="E.g., pronounced hourglass"
                            className="w-full bg-background border border-border rounded-xl p-2 text-xs text-foreground outline-none focus:border-emerald-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                            Chest / Bust
                          </label>
                          <input
                            value={physicalId.body.chest_bust}
                            onChange={(e) => updatePhysicalField('body', 'chest_bust', e.target.value)}
                            placeholder="E.g., very heavy prominent natural bust"
                            className="w-full bg-background border border-border rounded-xl p-2 text-xs text-foreground outline-none focus:border-emerald-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                            Waist
                          </label>
                          <input
                            value={physicalId.body.waist}
                            onChange={(e) => updatePhysicalField('body', 'waist', e.target.value)}
                            placeholder="E.g., narrow and clearly defined"
                            className="w-full bg-background border border-border rounded-xl p-2 text-xs text-foreground outline-none focus:border-emerald-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                            Hips & Thighs
                          </label>
                          <input
                            value={physicalId.body.hips}
                            onChange={(e) => updatePhysicalField('body', 'hips', e.target.value)}
                            placeholder="E.g., wide and rounded"
                            className="w-full bg-background border border-border rounded-xl p-2 text-xs text-foreground outline-none focus:border-emerald-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                            Abdomen / Stomach
                          </label>
                          <input
                            value={physicalId.body.abdomen}
                            onChange={(e) => updatePhysicalField('body', 'abdomen', e.target.value)}
                            placeholder="E.g., soft natural lower-belly fullness, no visible abs"
                            className="w-full bg-background border border-border rounded-xl p-2 text-xs text-foreground outline-none focus:border-emerald-500"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Section 4: Turn 0 Identity Lock Rule */}
                    <div>
                      <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                        Turn 0 Identity Lock Rule (Contract for ChatGPT)
                      </label>
                      <textarea
                        value={lockRule}
                        onChange={(e) => updateLockRule(e.target.value)}
                        rows={3}
                        className="w-full bg-background border border-border rounded-xl p-2.5 text-xs text-foreground outline-none focus:border-emerald-500 leading-relaxed font-sans"
                        placeholder="Preserve character across generations without redesigning physical traits..."
                      />
                    </div>
                  </div>
                ) : (
                  /* Mode B: Error-Proof Raw JSON Spec */
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-muted-foreground">
                        Canonical JSON sent to ChatGPT in Turn 0 Handshake:
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            hapticImpact('light');
                            setRawImportInput(jsonText);
                            setIsImportModalOpen(true);
                          }}
                          className="min-h-[38px] px-3 py-1.5 text-xs font-semibold rounded-xl bg-muted hover:bg-muted/80 text-foreground border border-border transition-all flex items-center gap-1.5 active:scale-95"
                        >
                          <UploadCloud className="w-3.5 h-3.5 text-emerald-500" />
                          <span>Import / Paste</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleCopyJson}
                          className="min-h-[38px] px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition-all flex items-center gap-1.5 active:scale-95 shadow-2xs"
                        >
                          {copiedJson ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copy JSON</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="relative rounded-2xl border border-border bg-card dark:bg-[#0a0a0c] p-3.5 text-emerald-600 dark:text-emerald-400 font-mono text-[11.5px] leading-relaxed overflow-x-auto max-h-96 shadow-inner">
                      <pre>{jsonText}</pre>
                    </div>
                  </div>
                )}
              </div>

              {/* Optional: Wardrobes / Outfits Drawer Toggle */}
              <div className="pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => {
                    hapticImpact('selection');
                    setShowWardrobes(!showWardrobes);
                  }}
                  className="w-full min-h-[44px] flex items-center justify-between py-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Shirt className="w-4 h-4 text-muted-foreground" />
                    <span>Saved Wardrobes & Outfits ({editingChar.wardrobes?.length || 0})</span>
                  </div>
                  {showWardrobes ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>

                {showWardrobes && (
                  <div className="space-y-2.5 pt-2 animate-in fade-in duration-150">
                    <div className="flex justify-end">
                      <button
                        onClick={() => {
                          hapticImpact('light');
                          const newW = {
                            id: Date.now().toString(),
                            name: 'New Outfit',
                            description: '',
                          };
                          setEditingChar({
                            ...editingChar,
                            wardrobes: [...(editingChar.wardrobes || []), newW],
                          });
                        }}
                        className="min-h-[38px] px-3 text-xs text-emerald-600 dark:text-emerald-400 font-semibold hover:underline flex items-center"
                      >
                        + Add Outfit
                      </button>
                    </div>

                    <div className="space-y-2.5">
                      {editingChar.wardrobes?.map((w, idx) => (
                        <div
                          key={w.id}
                          className="p-3.5 border border-border rounded-2xl bg-muted/40 space-y-2.5 relative"
                        >
                          <button
                            onClick={() => {
                              hapticImpact('light');
                              const updated = (editingChar.wardrobes || []).filter((ww) => ww.id !== w.id);
                              setEditingChar({ ...editingChar, wardrobes: updated });
                            }}
                            className="min-w-[40px] min-h-[40px] flex items-center justify-center absolute top-1 right-1 text-muted-foreground hover:text-destructive p-2 transition-colors rounded-xl"
                            aria-label="Remove outfit"
                          >
                            <X className="w-4 h-4" />
                          </button>
                          <input
                            value={w.name}
                            onChange={(e) => {
                              const arr = [...(editingChar.wardrobes || [])];
                              arr[idx].name = e.target.value;
                              setEditingChar({ ...editingChar, wardrobes: arr });
                            }}
                            className="w-full bg-transparent font-medium border-b border-border outline-none pb-1 text-xs text-foreground focus:border-emerald-500 pr-10"
                            placeholder="Outfit Name (e.g., Casual Linen)"
                          />
                          <textarea
                            value={w.description}
                            onChange={(e) => {
                              const arr = [...(editingChar.wardrobes || [])];
                              arr[idx].description = e.target.value;
                              setEditingChar({ ...editingChar, wardrobes: arr });
                            }}
                            className="w-full bg-transparent text-xs resize-none outline-none border-none mt-1 h-12 text-foreground leading-relaxed"
                            placeholder="Clothing description..."
                          />
                          <label className="flex items-center gap-2 text-xs cursor-pointer mt-1 font-medium text-muted-foreground">
                            <input
                              type="radio"
                              name="active_wardrobe"
                              checked={editingChar.active_wardrobe_id === w.id}
                              onChange={() => {
                                hapticImpact('selection');
                                setEditingChar({ ...editingChar, active_wardrobe_id: w.id });
                              }}
                              className="accent-emerald-600 w-4 h-4"
                            />
                            <span>Active Outfit</span>
                          </label>
                        </div>
                      ))}
                      {(!editingChar.wardrobes || editingChar.wardrobes.length === 0) && (
                        <p className="text-xs text-muted-foreground italic">No wardrobes added.</p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Danger Zone: Delete Character */}
              {editingChar.id && (
                <div className="pt-2">
                  <button
                    onClick={() => handleDelete(editingChar.id!, editingChar.name || 'Character')}
                    className="w-full min-h-[44px] h-11 py-2.5 px-3 flex items-center justify-center gap-2 border border-destructive/30 text-destructive hover:bg-destructive/10 rounded-xl text-xs font-semibold transition-all active:scale-[0.98]"
                  >
                    <Trash2 className="w-4 h-4" /> Delete Character
                  </button>
                </div>
              )}

              {/* Save Button */}
              <div className="pt-2 border-t border-border sticky bottom-0 bg-card pb-1">
                <button
                  onClick={handleSave}
                  disabled={loading || !editingChar.name}
                  className="w-full min-h-[48px] h-12 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-xl shadow-md transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  {loading ? 'Saving...' : 'Save Character'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── ERROR-PROOF IMPORT / PASTE JSON MODAL ── */}
      {isImportModalOpen && (
        <div
          className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => {
            hapticImpact('light');
            setIsImportModalOpen(false);
          }}
        >
          <div
            className="w-full max-w-lg bg-card text-card-foreground border border-border rounded-2xl shadow-2xl p-5 space-y-4 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UploadCloud className="w-4 h-4 text-emerald-500" />
                <h3 className="text-sm font-bold text-foreground">
                  Import / Paste Character Lock JSON
                </h3>
              </div>
              <button
                onClick={() => {
                  hapticImpact('light');
                  setIsImportModalOpen(false);
                }}
                className="min-w-[40px] min-h-[40px] text-muted-foreground hover:text-foreground p-2 rounded-xl hover:bg-muted transition-colors flex items-center justify-center"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Paste your character lock JSON below. The parser automatically repairs trailing commas, fixes formatting quirks, strips code fences, and populates all structured fields.
            </p>

            {importError && (
              <div className="p-2.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="leading-snug">{importError}</span>
              </div>
            )}

            <textarea
              value={rawImportInput}
              onChange={(e) => {
                setRawImportInput(e.target.value);
                if (importError) setImportError(null);
              }}
              rows={10}
              placeholder='{\n  "character_lock": {\n    "physical_identity": {\n      "face": { ... }\n    }\n  }\n}'
              className="w-full bg-background border border-border rounded-xl p-3 font-mono text-[11px] text-foreground outline-none focus:border-emerald-500 leading-relaxed"
            />

            <div className="flex items-center justify-end gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => {
                  hapticImpact('light');
                  setIsImportModalOpen(false);
                  setImportError(null);
                }}
                className="min-h-[44px] px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-colors active:scale-95"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApplyImportedJson}
                className="min-h-[44px] px-5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs transition-all active:scale-95 flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Apply & Populate Fields</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── HIGH-RESOLUTION IMAGE LIGHTBOX MODAL ── */}
      {previewImage && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex flex-col p-4 sm:p-6 animate-in fade-in duration-150"
          onClick={() => {
            hapticImpact('light');
            setPreviewImage(null);
          }}
        >
          <div
            className="flex items-center justify-between text-white pb-3 shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm sm:text-base">{previewImage.title}</span>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={previewImage.url}
                target="_blank"
                rel="noreferrer"
                className="min-h-[44px] min-w-[44px] px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-medium flex items-center gap-1.5 transition-colors active:scale-95"
                title="Open in new tab"
              >
                <ExternalLink className="w-4 h-4" />
                <span className="hidden sm:inline">Open full</span>
              </a>
              <button
                onClick={() => {
                  hapticImpact('light');
                  setPreviewImage(null);
                }}
                className="min-w-[44px] min-h-[44px] p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors flex items-center justify-center active:scale-95"
                aria-label="Close image preview"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div
            className="flex-1 flex items-center justify-center min-h-0 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={previewImage.url}
              alt={previewImage.title}
              className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
}
