import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { GIF_CATEGORIES } from '../lib/gifCatalog';
import { Search, X, Sparkles, Image as ImageIcon } from 'lucide-react';
import { GiphyFetch } from '@giphy/js-fetch-api';
import { Grid } from '@giphy/react-components';

// Initialize Giphy Fetch with the API key from environment variables
const gf = new GiphyFetch(import.meta.env.VITE_GIPHY_API_KEY || 'sXpGFDGZs0Dv1mmNFvYaGUvYwKX0PWIh'); // Fallback key just in case

const GifPicker = ({ onGifSelect, initialTab = 'gifs', hideTopTabs = false }) => {
  const [activeTab, setActiveTab] = useState(initialTab); // 'gifs' | 'stickers'
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  useEffect(() => {
    if (initialTab && (initialTab === 'gifs' || initialTab === 'stickers')) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Track container width for the Giphy Grid
  const containerRef = useRef(null);
  const [width, setWidth] = useState(() => {
    if (typeof window !== 'undefined') {
      return Math.max(180, Math.min(window.innerWidth - 32, 350) - 16);
    }
    return 300;
  });

  const updateWidth = useCallback(() => {
    if (containerRef.current) {
      const measured = containerRef.current.offsetWidth;
      if (measured > 50) {
        setWidth(Math.max(180, measured - 16));
      } else if (typeof window !== 'undefined') {
        const fallback = Math.min(window.innerWidth - 32, 350) - 16;
        setWidth(Math.max(180, fallback));
      }
    }
  }, []);

  useEffect(() => {
    updateWidth();
    const handleResize = () => updateWidth();
    window.addEventListener('resize', handleResize);

    let observer;
    if (containerRef.current && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => {
        updateWidth();
      });
      observer.observe(containerRef.current);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      if (observer) observer.disconnect();
    };
  }, [updateWidth]);

  // Fetch function required by Giphy Grid
  const fetchGifs = useCallback((offset) => {
    const isStickers = activeTab === 'stickers';
    // If a category (other than 'all') is selected, use it as the search term, otherwise use searchQuery
    const term = selectedCategory !== 'all' ? selectedCategory : searchQuery.trim();

    if (term) {
      // Search
      return isStickers
        ? gf.search(term, { type: 'stickers', offset, limit: 20 })
        : gf.search(term, { offset, limit: 20 });
    } else {
      // Trending
      return isStickers
        ? gf.trending({ type: 'stickers', offset, limit: 20 })
        : gf.trending({ offset, limit: 20 });
    }
  }, [activeTab, selectedCategory, searchQuery]);

  // Key to force Grid re-render when search/tab changes
  const gridKey = `${activeTab}-${selectedCategory}-${searchQuery}`;
  const columnsCount = width < 290 ? 2 : 3;

  return (
    <div className="flex flex-col h-[380px] sm:h-[400px] w-full max-w-full select-none text-theme-main overflow-hidden">
      {/* Top Header Tabs: GIFs / Stickers */}
      {!hideTopTabs && (
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
      )}

      {/* Search Input */}
      <div className="p-2.5 border-b border-[var(--glass-border)] bg-[var(--glass-surface)]">
        <div className="relative flex items-center w-full">
          <Search size={15} className="absolute left-3 text-theme-muted pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (e.target.value && selectedCategory !== 'all') {
                setSelectedCategory('all'); // Reset category chip if typing manually
              }
            }}
            placeholder={`Search ${activeTab === 'gifs' ? 'GIFs...' : 'stickers...'}`}
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
            onClick={() => {
              setSelectedCategory(cat.id);
              if (searchQuery) setSearchQuery(''); // Clear manual search if picking category
            }}
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
      <div ref={containerRef} className="flex-1 p-2.5 overflow-y-auto overflow-x-hidden custom-scrollbar bg-[var(--glass-heavy)] w-full min-w-0">
        <Grid
          key={gridKey}
          fetchGifs={fetchGifs}
          width={width}
          columns={columnsCount}
          gutter={6}
          noResultsMessage={
            <div className="flex flex-col items-center justify-center h-48 text-center p-4">
              <ImageIcon size={32} className="text-theme-muted/40 mb-2" />
              <p className="text-xs font-semibold text-theme-main">No {activeTab} found</p>
              <p className="text-[11px] text-theme-muted mt-0.5">Try searching for different keywords</p>
            </div>
          }
          onGifClick={(gif, e) => {
            e.preventDefault();
            // Get highest quality url, falling back to original
            const gifUrl = gif.images.original.url;
            onGifSelect(gifUrl);
          }}
          hideAttribution={true} // Cleaner UI
        />
      </div>
    </div>
  );
};

export default GifPicker;
