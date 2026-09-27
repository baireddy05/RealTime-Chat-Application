import { useState, useRef, useEffect, useCallback } from "react";
import { Play, Pause, Mic } from "lucide-react";

// Acoustic visual profile for waveform bars
const ACOUSTIC_WAVE_PROFILE = [
  35, 55, 75, 45, 90, 65, 80, 40, 50, 70, 85, 45, 95, 60, 80, 50,
  65, 90, 75, 40, 60, 85, 100, 70, 55, 80, 65, 45, 70, 85, 50, 60,
  75, 45, 65, 40
];

// Global duration cache so repeated mounts don't re-decode WebM audio.
// Bounded (LRU-200): hundreds of voice notes used to pin URLs forever.
const audioDurationCache = new Map();
const cacheAudioDuration = (url, dur) => {
  try {
    if (audioDurationCache.size >= 200) {
      audioDurationCache.delete(audioDurationCache.keys().next().value);
    }
    cacheAudioDuration(url, dur);
  } catch {}
};

// Helper to decode WebM / audio duration accurately using Web Audio API
// Shared singleton context (browsers cap ~6 contexts) + abortable decode.
let sharedAudioCtx = null;
const getSharedAudioCtx = () => {
  try {
    if (sharedAudioCtx && sharedAudioCtx.state !== "closed") return sharedAudioCtx;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    sharedAudioCtx = new AudioCtx();
    return sharedAudioCtx;
  } catch {
    return null;
  }
};
const fetchExactAudioDuration = async (url, signal) => {
  if (!url) return 0;
  if (audioDurationCache.has(url)) return audioDurationCache.get(url);
  try {
    const response = await fetch(url, signal ? { signal } : undefined);
    if (!response.ok) return 0;
    const arrayBuffer = await response.arrayBuffer();
    if (signal?.aborted) return 0;
    const ctx = getSharedAudioCtx();
    if (ctx) {
      try {
        if (ctx.state === "suspended") await ctx.resume().catch(() => {});
      } catch {}
      const copy = arrayBuffer.slice(0);
      const audioBuffer = await ctx.decodeAudioData(copy);
      const dur = audioBuffer.duration;
      if (dur && isFinite(dur) && dur > 0) {
        cacheAudioDuration(url, dur);
        return dur;
      }
    }
  } catch (err) {
    if (err?.name === "AbortError") return 0;
    // Fallback gracefully if fetch or decode is blocked
  }
  return 0;
};

const AudioMessagePlayer = ({ audioUrl, isMine }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(() => (audioUrl ? audioDurationCache.get(audioUrl) || 0 : 0));
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [hoverIndex, setHoverIndex] = useState(null);
  const [isSeeking, setIsSeeking] = useState(false);

  const audioRef = useRef(null);
  const animFrameRef = useRef(null);

  // Update time smoothly with requestAnimationFrame while audio is playing
  const startProgressTracking = useCallback(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    const track = () => {
      const audio = audioRef.current;
      if (audio && !audio.paused && !audio.ended) {
        setCurrentTime(audio.currentTime);
        if (audio.duration && isFinite(audio.duration) && audio.duration > 0) {
          setDuration(audio.duration);
          if (audioUrl) cacheAudioDuration(audioUrl, audio.duration);
        }
        animFrameRef.current = requestAnimationFrame(track);
      }
    };
    animFrameRef.current = requestAnimationFrame(track);
  }, [audioUrl]);

  const stopProgressTracking = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
  }, []);

  // Fetch audio duration via Web Audio API decode on mount
  useEffect(() => {
    let isMounted = true;
    const ctrl = new AbortController();
    if (audioUrl && (!duration || duration === 0)) {
      fetchExactAudioDuration(audioUrl, ctrl.signal).then((dur) => {
        if (isMounted && dur > 0) {
          setDuration(dur);
        }
      });
    }
    return () => {
      isMounted = false;
      try {
        ctrl.abort();
      } catch {}
    };
  }, [audioUrl]);

  // Handle native audio element lifecycle
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.preservesPitch = true;
    audio.webkitPreservesPitch = true;

    const setAudioData = () => {
      if (audio.duration && isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
        if (audioUrl) cacheAudioDuration(audioUrl, audio.duration);
      } else if (audio.duration === Infinity) {
        // Chromium WebM Infinity duration bug fix: seek to huge offset to force browser to compute duration
        const onSeeked = () => {
          audio.removeEventListener("seeked", onSeeked);
          if (isFinite(audio.duration) && audio.duration > 0) {
            setDuration(audio.duration);
            if (audioUrl) cacheAudioDuration(audioUrl, audio.duration);
          }
          audio.currentTime = 0;
        };
        audio.addEventListener("seeked", onSeeked);
        audio.currentTime = 1e10;
      }
    };

    const onPlay = () => {
      setIsPlaying(true);
      startProgressTracking();
    };

    const onPause = () => {
      setIsPlaying(false);
      stopProgressTracking();
      if (audio) setCurrentTime(audio.currentTime);
    };

    const onTimeUpdate = () => {
      if (!isSeeking) {
        setCurrentTime(audio.currentTime);
      }
    };

    const onEnded = () => {
      setIsPlaying(false);
      stopProgressTracking();
      setCurrentTime(0);
      if (audio) audio.currentTime = 0;
    };

    audio.addEventListener("loadedmetadata", setAudioData);
    audio.addEventListener("durationchange", setAudioData);
    audio.addEventListener("canplay", setAudioData);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("ended", onEnded);

    return () => {
      stopProgressTracking();
      try {
        audio.pause();
      } catch {}
      audio.removeEventListener("loadedmetadata", setAudioData);
      audio.removeEventListener("durationchange", setAudioData);
      audio.removeEventListener("canplay", setAudioData);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("ended", onEnded);
    };
  }, [audioUrl, startProgressTracking, stopProgressTracking]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch((err) => {
        console.warn("Audio playback failed:", err);
      });
    }
  };

  const toggleSpeed = () => {
    if (!audioRef.current) return;
    const speeds = [1, 1.5, 2];
    const nextSpeed = speeds[(speeds.indexOf(playbackSpeed) + 1) % speeds.length];
    setPlaybackSpeed(nextSpeed);
    audioRef.current.playbackRate = nextSpeed;
  };

  const handleSeekChange = (e) => {
    const time = Number(e.target.value);
    setCurrentTime(time);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };

  const handleSeekStart = () => {
    setIsSeeking(true);
  };

  const handleSeekEnd = () => {
    setIsSeeking(false);
  };

  const handleBarClick = (index) => {
    const totalDuration = duration || (audioRef.current?.duration && isFinite(audioRef.current.duration) ? audioRef.current.duration : 0);
    if (!totalDuration) return;
    const seekRatio = index / ACOUSTIC_WAVE_PROFILE.length;
    const seekTime = seekRatio * totalDuration;
    setCurrentTime(seekTime);
    if (audioRef.current) {
      audioRef.current.currentTime = seekTime;
    }
  };

  const formatTime = (secs) => {
    if (!secs || isNaN(secs) || !isFinite(secs) || secs < 0) return "0:00";
    const minutes = Math.floor(secs / 60);
    const seconds = Math.floor(secs % 60);
    return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
  };

  const activeDuration = duration > 0 ? duration : (audioRef.current?.duration && isFinite(audioRef.current.duration) ? audioRef.current.duration : 0);
  const progressPercent = activeDuration > 0 ? Math.min(100, Math.max(0, (currentTime / activeDuration) * 100)) : 0;

  return (
    <div
      className="flex items-center gap-3 p-3 rounded-2xl min-w-[270px] sm:min-w-[300px] max-w-[340px] select-none shadow-sm transition-all border bg-current/5 text-current border-current/10"
    >
      <audio ref={audioRef} src={audioUrl} preload="auto" />

      {/* Play/Pause Button */}
      <button
        type="button"
        onClick={togglePlay}
        className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-transform active:scale-90 shadow-md ${
          isMine
            ? "bg-white text-zinc-900 dark:bg-white dark:text-zinc-900"
            : "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
        }`}
        title={isPlaying ? "Pause" : "Play voice note"}
      >
        {isPlaying ? (
          <Pause size={16} fill="currentColor" />
        ) : (
          <Play size={16} fill="currentColor" className="ml-0.5" />
        )}
      </button>

      {/* Interactive Waveform & Realtime Progress Scrubber */}
      <div className="flex-1 flex flex-col justify-center gap-1.5 min-w-0">
        <div
          className="relative h-7 flex items-center gap-[2.5px] px-1 cursor-pointer group"
          onMouseLeave={() => setHoverIndex(null)}
        >
          {/* Waveform Bars with Realtime Played Progress Indicator */}
          {ACOUSTIC_WAVE_PROFILE.map((height, idx) => {
            const barProgress = ((idx + 0.5) / ACOUSTIC_WAVE_PROFILE.length) * 100;
            const isPlayed = barProgress <= progressPercent;
            const isHovered = hoverIndex !== null && idx <= hoverIndex;

            return (
              <span
                key={idx}
                onMouseEnter={() => setHoverIndex(idx)}
                onClick={() => handleBarClick(idx)}
                style={{ height: `${height}%` }}
                className={`w-[3px] rounded-full transition-all duration-75 flex-shrink-0 ${
                  isPlayed || isHovered
                    ? "bg-current opacity-100 scale-y-105"
                    : "bg-current opacity-25 group-hover:opacity-40"
                }`}
              />
            );
          })}

          {/* Real-time Seek Range Slider over Waveform */}
          <input
            type="range"
            min="0"
            max={activeDuration || 100}
            step="0.05"
            value={currentTime}
            onMouseDown={handleSeekStart}
            onTouchStart={handleSeekStart}
            onMouseUp={handleSeekEnd}
            onTouchEnd={handleSeekEnd}
            onChange={handleSeekChange}
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-20"
            title="Drag to seek voice note"
          />
        </div>

        {/* Time Progress Display (Elapsed / Total Length) & Speed Control */}
        <div className="flex justify-between items-center text-[10.5px] font-mono font-medium px-1 opacity-90 tracking-tight">
          {/* Realtime Elapsed and Full Duration */}
          <span className="flex items-center gap-1">
            <span>{formatTime(currentTime)}</span>
            <span className="opacity-40 font-sans">/</span>
            <span className="opacity-75">{formatTime(activeDuration)}</span>
          </span>

          <div className="flex items-center gap-1.5 font-sans">
            {/* Playback Speed Pill */}
            <button
              type="button"
              onClick={toggleSpeed}
              className="text-[9.5px] font-bold px-2 py-0.5 rounded-full transition-all active:scale-95 bg-current/10 text-current hover:bg-current/20 border border-current/20"
              title="Change playback speed"
            >
              {playbackSpeed}x
            </button>
          </div>
        </div>
      </div>

      {/* Microphone Icon Badge */}
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 bg-current/10 text-current"
      >
        <Mic size={13} className={isPlaying ? "animate-pulse" : "opacity-80"} />
      </div>
    </div>
  );
};

export default AudioMessagePlayer;
