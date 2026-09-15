import React, { useState, useMemo } from 'react';
import { GIF_CATEGORIES, GIF_ITEMS, STICKER_ITEMS } from '../lib/gifCatalog';
import { Search, X, Sparkles, Image as ImageIcon } from 'lucide-react';

const GifPicker = ({ onGifSelect }) => {
  const [activeTab, setActiveTab] = useState('gifs'); // 'gifs' | 'stickers'
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loadedImages, setLoadedImages] = useState({});

  const items = useMemo(() => {
    const sourceList = activeTab === 'gifs' ? GIF_ITEMS : STICKER_ITEMS;
    const query = searchQuery.trim().toLowerCase();

    return sourceList.filter((item) => {
      // Category filter
      if (selectedCategory !== 'all' && item.category !== selectedCategory) {
        return false;
      }
      // Search query filter
      if (query) {
        const matchesTitle = item.title.toLowerCase().includes(query);
        const matchesTags = item.tags.some((t) => t.toLowerCase().includes(query));
        return matchesTitle || matchesTags;
      }
      return true;
    });
  }, [activeTab, selectedCategory, searchQuery]);

  const handleImageLoad = (id) => {
    setLoadedImages((prev) => ({ ...prev, [id]: true }));
  };

  return (
    <div className="flex flex-col h-[400px] select-none text-theme-main">
      {/* Top Header Tabs: GIFs / Stickers */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-[var(--glass-border)] bg-[var(--glass-header)]">
        <div className="flex items-center gap-1.5 p-0.5 rounded-xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 w-full">
          <button
            type="button"
            onClick={() => {
              setActiveTab('gifs');
              setSelectedCategory('all');
            }}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'gifs'
                ? 'bg-zinc-900 text-white dark:bg-white dark:text-[#0d0c11] shadow-sm'
                : 'text-theme-muted hover:text-theme-main'
            }`}
          >
            <span className="material-symbols-outlined text-[15px]">gif_box</span>
            <span>GIFs</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('stickers');
              setSelectedCategory('all');
            }}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'stickers'
                ? 'bg-zinc-900 text-white dark:bg-white dark:text-[#0d0c11] shadow-sm'
                : 'text-theme-muted hover:text-theme-main'
            }`}
          >
            <Sparkles size={14} />
            <span>Stickers</span>
          </button>
        </div>
      </div>

      {/* Search Input */}
      <div className="p-2.5 border-b border-[var(--glass-border)] bg-[var(--glass-surface)]">
        <div className="relative flex items-center w-full">
          <Search size={15} className="absolute left-3 text-theme-muted pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search ${activeTab === 'gifs' ? 'GIFs (e.g. happy, laugh, dance)...' : 'stickers...'}`}
            className="w-full pl-9 pr-8 py-2 rounded-xl text-xs bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-theme-main placeholder:text-theme-muted focus:outline-none focus:ring-1 focus:ring-accent-primary transition-all"
            autoFocus
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 p-0.5 rounded-full text-theme-muted hover:text-theme-main"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Category Pills Strip */}
      <div className="px-2.5 py-1.5 border-b border-[var(--glass-border)] flex items-center gap-1.5 overflow-x-auto no-scrollbar bg-[var(--glass-surface)] shrink-0">
        {GIF_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition-all cursor-pointer ${
              selectedCategory === cat.id
                ? 'bg-zinc-900 text-white dark:bg-white dark:text-[#0d0c11] shadow-sm'
                : 'bg-black/5 dark:bg-white/5 text-theme-muted hover:text-theme-main hover:bg-black/10 dark:hover:bg-white/10 border border-black/5 dark:border-white/10'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Grid Display Area */}
      <div className="flex-1 p-2.5 overflow-y-auto custom-scrollbar bg-[var(--glass-heavy)]">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center p-4">
            <ImageIcon size={32} className="text-theme-muted/40 mb-2" />
            <p className="text-xs font-semibold text-theme-main">No {activeTab} found</p>
            <p className="text-[11px] text-theme-muted mt-0.5">Try searching for different keywords or categories</p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('all');
              }}
              className="mt-3 px-3 py-1 rounded-full text-xs bg-accent-primary/15 text-accent-primary font-medium hover:bg-accent-primary/25 transition-colors"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {items.map((item) => (
              <div
                key={item.id}
                onClick={() => onGifSelect(item.url)}
                className="group relative aspect-video rounded-xl overflow-hidden bg-black/10 dark:bg-white/5 border border-black/10 dark:border-white/10 cursor-pointer shadow-sm hover:shadow-md hover:scale-[1.02] active:scale-95 transition-all"
                title={item.title}
              >
                {/* Skeleton Loader placeholder */}
                {!loadedImages[item.id] && (
                  <div className="absolute inset-0 bg-black/10 dark:bg-white/5 animate-pulse flex items-center justify-center">
                    <span className="material-symbols-outlined text-xs text-theme-muted/40">gif</span>
                  </div>
                )}
                <img
                  src={item.preview || item.url}
                  alt={item.title}
                  loading="lazy"
                  onLoad={() => handleImageLoad(item.id)}
                  className={`w-full h-full object-cover transition-opacity duration-300 ${
                    loadedImages[item.id] ? 'opacity-100' : 'opacity-0'
                  }`}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-1.5">
                  <span className="text-[10px] text-white font-medium truncate w-full drop-shadow">
                    {item.title}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default GifPicker;
