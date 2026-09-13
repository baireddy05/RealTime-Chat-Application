import { useState, useRef, useEffect } from "react";
import { Play, Pause, Mic } from "lucide-react";

const ACOUSTIC_WAVE_PROFILE = [
  35, 55, 75, 45, 90, 65, 80, 40, 50, 70, 85, 45, 95, 60, 80, 50,
  65, 90, 75, 40, 60, 85, 100, 70, 55, 80, 65, 45, 70, 85, 50, 60,
  75, 45, 65, 40
];

const AudioMessagePlayer = ({ audioUrl, isMine }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [hoverIndex, setHoverIndex] = useState(null);
  const audioRef = useRef(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.preservesPitch = true;
    audio.webkitPreservesPitch = true;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const setAudioData = () => {
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
    };
    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener("timeupdate", updateTime);
    audio.addEventListener("loadedmetadata", setAudioData);
    audio.addEventListener("durationchange", setAudioData);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.removeEventListener("timeupdate", updateTime);
      audio.removeEventListener("loadedmetadata", setAudioData);
      audio.removeEventListener("durationchange", setAudioData);
      audio.removeEventListener("ended", onEnded);
    };
  }, []);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const toggleSpeed = () => {
    if (!audioRef.current) return;
    const speeds = [1, 1.5, 2];
    const nextSpeed = speeds[(speeds.indexOf(playbackSpeed) + 1) % speeds.length];
    setPlaybackSpeed(nextSpeed);
    audioRef.current.playbackRate = nextSpeed;
  };

  const handleSeek = (e) => {
    const time = Number(e.target.value);
    setCurrentTime(time);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };

  const handleBarClick = (index) => {
    if (!duration) return;
    const seekTime = (index / ACOUSTIC_WAVE_PROFILE.length) * duration;
    setCurrentTime(seekTime);
    if (audioRef.current) {
      audioRef.current.currentTime = seekTime;
    }
  };

  const formatTime = (secs) => {
    if (!secs || isNaN(secs) || !isFinite(secs) || secs <= 0) return "0:00";
    const minutes = Math.floor(secs / 60);
    const seconds = Math.floor(secs % 60);
    return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      className={`flex items-center gap-3 p-2.5 rounded-2xl min-w-[260px] max-w-[320px] select-none shadow-sm transition-all border ${
        isMine
          ? "bg-white/15 text-white border-white/20"
          : "bg-[var(--glass-surface)] text-theme-main border-[var(--glass-border)] shadow-glass"
      }`}
    >
      <audio ref={audioRef} src={audioUrl} preload="metadata" />

      {/* Play/Pause Button */}
      <button
        type="button"
        onClick={togglePlay}
        className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-transform active:scale-90 shadow-md ${
          isMine
            ? "bg-white text-accent-primary hover:bg-white/90"
            : "bg-gradient-to-tr from-accent-primary to-accent-secondary text-white hover:brightness-110"
        }`}
        title={isPlaying ? "Pause" : "Play voice note"}
      >
        {isPlaying ? (
          <Pause size={15} fill="currentColor" />
        ) : (
          <Play size={15} fill="currentColor" className="ml-0.5" />
        )}
      </button>

      {/* Interactive 36-bar Waveform Scrubber */}
      <div className="flex-1 flex flex-col justify-center gap-1.5 min-w-0">
        <div
          className="relative h-6 flex items-center gap-[2px] px-1 cursor-pointer group"
          onMouseLeave={() => setHoverIndex(null)}
        >
          {ACOUSTIC_WAVE_PROFILE.map((height, idx) => {
            const barProgress = (idx / ACOUSTIC_WAVE_PROFILE.length) * 100;
            const isPlayed = barProgress <= progressPercent;
            const isHovered = hoverIndex !== null && idx <= hoverIndex;

            return (
              <span
                key={idx}
                onMouseEnter={() => setHoverIndex(idx)}
                onClick={() => handleBarClick(idx)}
                style={{ height: `${height}%` }}
                className={`w-[3px] rounded-full transition-all duration-100 ${
                  isMine
                    ? isPlayed || isHovered
                      ? "bg-white"
                      : "bg-white/35"
                    : isPlayed || isHovered
                    ? "bg-[#8B5CF6]"
                    : "bg-white/20 group-hover:bg-white/30"
                }`}
              />
            );
          })}

          <input
            type="range"
            min="0"
            max={duration || 100}
            step="0.1"
            value={currentTime}
            onChange={handleSeek}
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            title="Drag to seek audio"
          />
        </div>

        {/* Time & Speed Controls */}
        <div className="flex justify-between items-center text-[10px] font-medium px-1 opacity-85">
          <span>{isPlaying ? formatTime(currentTime) : formatTime(duration)}</span>

          <div className="flex items-center gap-1.5">
            {/* Speed Pill */}
            <button
              type="button"
              onClick={toggleSpeed}
              className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full transition-all active:scale-95 ${
                isMine
                  ? "bg-white/25 text-white hover:bg-white/35"
                  : "bg-accent-primary/15 text-accent-primary hover:bg-accent-primary/25 border border-accent-primary/30"
              }`}
              title="Change playback speed"
            >
              {playbackSpeed}x
            </button>
          </div>
        </div>
      </div>

      {/* Audio Indicator */}
      <div
        className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
          isMine ? "bg-white/20 text-white" : "bg-accent-primary/20 text-accent-primary"
        }`}
      >
        <Mic size={12} className={isPlaying ? "animate-pulse" : ""} />
      </div>
    </div>
  );
};

export default AudioMessagePlayer;
