import React, { useState, useContext } from 'react';
import { GiphyFetch } from '@giphy/js-fetch-api';
import { Grid, SearchBar, SearchContext, SearchContextManager } from '@giphy/react-components';

// Create a GiphyFetch instance with a public beta key. 
// For production, use your own API key.
const gf = new GiphyFetch('sXpGFDGpz0Dv1SAMvya6z27uDRRiRvVa');

const GifPickerGrid = ({ onGifSelect, type }) => {
  const { fetchGifs, searchKey } = useContext(SearchContext);
  
  return (
    <div className="giphy-grid-container custom-scrollbar overflow-y-auto" style={{ height: '300px' }}>
      <Grid 
        key={searchKey} 
        columns={3} 
        width={330} 
        fetchGifs={fetchGifs} 
        onGifClick={(gif, e) => {
          e.preventDefault();
          onGifSelect(gif.images.original.url);
        }} 
        noLink={true}
        hideAttribution={false}
      />
    </div>
  );
};

const GifPickerContent = ({ onGifSelect, type }) => {
  return (
    <div className="flex flex-col h-full">
      <div className="p-2 border-b border-[var(--glass-border)] bg-[var(--glass-surface)]">
        <SearchBar 
          placeholder={`Search ${type}...`} 
          autoFocus={true} 
        />
      </div>
      <div className="flex-1 overflow-hidden relative">
        <GifPickerGrid onGifSelect={onGifSelect} type={type} />
      </div>
    </div>
  );
};

const GifPicker = ({ onGifSelect }) => {
  const [activeTab, setActiveTab] = useState('gifs'); // 'gifs' or 'stickers'

  return (
    <div className="flex flex-col h-[380px]">
      <div className="flex items-center gap-2 px-2 py-1.5 border-b border-[var(--glass-border)] bg-[var(--glass-header)]">
        <button
          onClick={() => setActiveTab('gifs')}
          className={`flex-1 py-1 text-xs font-medium rounded-lg transition-colors ${
            activeTab === 'gifs' 
              ? 'bg-accent-primary/20 text-accent-primary' 
              : 'text-theme-muted hover:bg-[var(--glass-hover)] hover:text-theme-main'
          }`}
        >
          GIFs
        </button>
        <button
          onClick={() => setActiveTab('stickers')}
          className={`flex-1 py-1 text-xs font-medium rounded-lg transition-colors ${
            activeTab === 'stickers' 
              ? 'bg-accent-primary/20 text-accent-primary' 
              : 'text-theme-muted hover:bg-[var(--glass-hover)] hover:text-theme-main'
          }`}
        >
          Stickers
        </button>
      </div>
      <div className="flex-1 bg-[var(--glass-heavy)]">
        <SearchContextManager apiKey="sXpGFDGpz0Dv1SAMvya6z27uDRRiRvVa" options={{ type: activeTab }}>
          <GifPickerContent onGifSelect={onGifSelect} type={activeTab} />
        </SearchContextManager>
      </div>
    </div>
  );
};

export default GifPicker;
