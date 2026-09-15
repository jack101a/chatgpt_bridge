import { useState, useEffect } from 'react';
import { X, Plus, Lock, Unlock, UserCircle2, Shirt, Sparkles } from 'lucide-react';
import { CharacterCard } from '../../types';
import { api } from '../../lib/api';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  activeCharacter: CharacterCard | null;
  setActiveCharacter: (char: CharacterCard | null) => void;
  onNavigateToGenerator?: () => void;
}

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

  useEffect(() => {
    if (isOpen) {
      loadCharacters();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const loadCharacters = async () => {
    try {
      const data = await api.getCharacters();
      setCharacters(data);
    } catch (err) {
      console.error('Failed to load characters', err);
    }
  };

  const handleSave = async () => {
    if (!editingChar?.name || !editingChar?.visual_dna) return;
    setLoading(true);
    try {
      const saved = await api.saveCharacter(editingChar);
      setEditingChar(saved);
      if (activeCharacter?.id === saved.id) {
        setActiveCharacter(saved);
      }
      await loadCharacters();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleLockToggle = async (char: CharacterCard) => {
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
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm transition-opacity" onClick={onClose}>
      <div className="w-full max-w-md h-full bg-white dark:bg-[#1a1a1c] shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-white/10">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <UserCircle2 className="w-6 h-6" /> Character Studio
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {!editingChar ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  onClick={() => setEditingChar({ name: '', visual_dna: '', wardrobes: [] })}
                  className="w-full py-2.5 px-3 flex items-center justify-center gap-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 font-medium text-xs shadow-xs transition-all active:scale-95"
                >
                  <Plus className="w-4 h-4" /> New Character
                </button>
                {onNavigateToGenerator && (
                  <button
                    onClick={onNavigateToGenerator}
                    className="w-full py-2.5 px-3 flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 dark:bg-white/10 dark:hover:bg-white/15 text-[#0d0d0d] dark:text-white rounded-xl font-medium text-xs border border-[#e5e5e5] dark:border-white/10 transition-all active:scale-95"
                  >
                    <Sparkles className="w-4 h-4 text-emerald-500" /> Reference Studio
                  </button>
                )}
              </div>
              
              <div className="space-y-2">
                {characters.map(char => (
                  <div key={char.id} className="p-4 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 flex items-center justify-between">
                    <div>
                      <div className="font-semibold">{char.name}</div>
                      <div className="text-sm text-gray-500 truncate w-48">{char.visual_dna}</div>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleLockToggle(char)}
                        className={`p-2 rounded-lg ${char.is_locked ? 'bg-red-500/20 text-red-500' : 'bg-gray-200 dark:bg-white/10'}`}
                      >
                        {char.is_locked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                      </button>
                      <button onClick={() => setEditingChar(char)} className="px-3 py-1 bg-blue-600 text-white rounded-lg text-sm">
                        Edit
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4 animate-in fade-in">
              <button onClick={() => setEditingChar(null)} className="text-sm text-gray-500 hover:text-white flex items-center gap-1">
                ← Back to list
              </button>
              
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-lg">{editingChar.id ? 'Edit Character' : 'New Character'}</h3>
                {editingChar.id && (
                  <button 
                    onClick={() => handleLockToggle(editingChar as CharacterCard)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-medium text-sm transition-colors ${
                      editingChar.is_locked 
                        ? 'bg-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.5)]' 
                        : 'bg-gray-200 dark:bg-white/10 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {editingChar.is_locked ? <><Lock className="w-4 h-4" /> Locked Active</> : <><Unlock className="w-4 h-4" /> Lock Character</>}
                  </button>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input 
                  value={editingChar.name || ''} 
                  onChange={e => setEditingChar({...editingChar, name: e.target.value})}
                  className="w-full bg-transparent border border-gray-300 dark:border-white/20 rounded-lg p-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                  placeholder="E.g., Anya"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Visual DNA</label>
                <textarea 
                  value={editingChar.visual_dna || ''} 
                  onChange={e => setEditingChar({...editingChar, visual_dna: e.target.value})}
                  className="w-full bg-transparent border border-gray-300 dark:border-white/20 rounded-lg p-2 h-24 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                  placeholder="Core visual traits (e.g., 20yo, pink hair, green eyes)..."
                />
                <p className="text-xs text-gray-500 mt-1">Tip: Keep it focused on invariant physical traits.</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Persona & Roleplay</label>
                <textarea 
                  value={editingChar.persona || ''} 
                  onChange={e => setEditingChar({...editingChar, persona: e.target.value})}
                  className="w-full bg-transparent border border-gray-300 dark:border-white/20 rounded-lg p-2 h-24 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                  placeholder="Personality, background, system instructions..."
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium flex items-center gap-1"><Shirt className="w-4 h-4"/> Wardrobes</label>
                  <button 
                    onClick={() => {
                      const newW = { id: Date.now().toString(), name: 'New Outfit', description: '' };
                      setEditingChar({...editingChar, wardrobes: [...(editingChar.wardrobes || []), newW]});
                    }}
                    className="text-xs text-blue-500 hover:underline"
                  >
                    + Add Outfit
                  </button>
                </div>
                <div className="space-y-2">
                  {editingChar.wardrobes?.map((w, idx) => (
                    <div key={w.id} className="p-3 border border-gray-200 dark:border-white/10 rounded-lg bg-gray-50 dark:bg-white/5 space-y-2 relative">
                       <button onClick={() => {
                          const updated = (editingChar.wardrobes || []).filter(ww => ww.id !== w.id);
                          setEditingChar({...editingChar, wardrobes: updated});
                       }} className="absolute top-2 right-2 text-gray-400 hover:text-red-500"><X className="w-4 h-4"/></button>
                       <input 
                         value={w.name}
                         onChange={e => {
                           const arr = [...(editingChar.wardrobes || [])];
                           arr[idx].name = e.target.value;
                           setEditingChar({...editingChar, wardrobes: arr});
                         }}
                         className="w-full bg-transparent font-medium border-b border-gray-300 dark:border-white/20 outline-none pb-1"
                         placeholder="Outfit Name"
                       />
                       <textarea
                         value={w.description}
                         onChange={e => {
                           const arr = [...(editingChar.wardrobes || [])];
                           arr[idx].description = e.target.value;
                           setEditingChar({...editingChar, wardrobes: arr});
                         }}
                         className="w-full bg-transparent text-sm resize-none outline-none border-none mt-1 h-12"
                         placeholder="Clothing description..."
                       />
                       <label className="flex items-center gap-2 text-sm cursor-pointer mt-2">
                         <input type="radio" name="active_wardrobe" 
                           checked={editingChar.active_wardrobe_id === w.id}
                           onChange={() => setEditingChar({...editingChar, active_wardrobe_id: w.id})}
                         />
                         Active Outfit
                       </label>
                    </div>
                  ))}
                  {(!editingChar.wardrobes || editingChar.wardrobes.length === 0) && (
                    <p className="text-xs text-gray-500 italic">No wardrobes added.</p>
                  )}
                </div>
              </div>

              <div className="pt-4 border-t border-gray-200 dark:border-white/10">
                <button 
                  onClick={handleSave} 
                  disabled={loading || !editingChar.name || !editingChar.visual_dna}
                  className="w-full py-3 bg-white text-black dark:bg-white dark:text-black font-semibold rounded-xl hover:bg-gray-100 disabled:opacity-50"
                >
                  {loading ? 'Saving...' : 'Save Character'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
