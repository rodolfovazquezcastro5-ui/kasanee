
/* ============================================================
   ONEWAY
   CINEMATIC MUSIC EXPERIENCE
   AUDIOVISUAL ENGINE 01
============================================================ */


/* ============================================================
   01. CONFIGURATION
============================================================ */

const CONFIG = {

    audio: "musicatetto.mp3",
    background: "videodefondo.mp4",
    visual: "tettorecuadro.mp4",
    lyrics: "musicatetto.lrc",

    defaultVolume: 0.8,

    seekStep: 10,

    syncInterval: 650,
    syncTolerance: 0.065,
    hardSyncTolerance: 0.35,

    visualizerFPS: 24,
    visualizerBars: 48,
    visualizerSensitivity: 1.35,

    maxDpr: 1.25,

    lyricTransitionDuration: 650,
    lyricTypingMinSpeed: 18,
    lyricTypingMaxSpeed: 55,
    lyricTypingWindow: 0.72,
    lyricCharacterDuration: 220

};


/* ============================================================
   02. DOM REFERENCES
============================================================ */

const $ = selector => document.querySelector(selector);

const elements = {

    audio: $("#audioPlayer"),
    background: $("#backgroundVideo"),
    visual: $("#musicVideo"),

    playerCard: $("#playerCard"),

    playButton: $("#playButton"),
    playIcon: $("#playIcon"),
    pauseIcon: $("#pauseIcon"),

    forwardButton: $("#forwardButton"),
    backwardButton: $("#backwardButton"),

    muteButton: $("#muteButton"),
    volumeSlider: $("#volumeSlider"),

    progressTrack: $("#progressTrack"),
    progressFill: $("#progressFill"),
    progressThumb: $("#progressThumb"),

    currentTime: $("#currentTime"),
    duration: $("#duration"),

    lyricsToggle: $("#lyricsToggle"),
    lyricsContainer: $("#lyricsContainer"),
    lyricsDisplay: $("#lyricsDisplay"),

    previousLyric: $("#previousLyric"),
    currentLyric: $("#currentLyric"),
    nextLyric: $("#nextLyric"),

    lyricsStatus: $("#lyricsStatus"),

    visualizer: $("#audioVisualizer"),
    visualizerState: $("#visualizerState"),

    playbackStatus: $("#playbackStatus"),
    playbackStatusDot: $("#playbackStatusDot"),

    visualPlayIndicator: $("#visualPlayIndicator"),

    trackTitle: $("#trackTitle"),
    trackArtist: $("#trackArtist")

};


/* ============================================================
   03. APPLICATION STATE
============================================================ */

const state = {

    playing: false,
    loading: false,
    seeking: false,
    muted: false,

    previousVolume: CONFIG.defaultVolume,

    lyrics: [],
    lyricIndex: -1,
    lyricOffset: 0,

    audioContext: null,
    analyser: null,
    audioSource: null,
    frequencyData: null,

    audioContextReady: false,

    visualizerFrame: null,
    visualizerLastFrame: 0,

    backgroundSyncFrame: null,
    syncLastTime: 0,

    lyricTransitionTimer: null,

    secondaryVideoStarted: false,

    destroyed: false

};


/* ============================================================
   04. GENERAL UTILITIES
============================================================ */

function clamp(value, min, max) {

    return Math.min(Math.max(value, min), max);

}


function formatTime(seconds) {

    if (!Number.isFinite(seconds) || seconds < 0) {
        return "00:00";
    }

    const minutes = Math.floor(seconds / 60);
    const remaining = Math.floor(seconds % 60);

    return (
        String(minutes).padStart(2, "0") +
        ":" +
        String(remaining).padStart(2, "0")
    );

}


function setPlaybackStatus(message) {

    elements.playbackStatus.textContent = message;

}


function setLoading(loading) {

    state.loading = loading;

    elements.playerCard.classList.toggle(
        "is-loading",
        loading
    );

}


function updateVolumeAppearance() {

    const value = Number(elements.volumeSlider.value) * 100;

    elements.volumeSlider.style.background = `
        linear-gradient(
            90deg,
            var(--accent) ${value}%,
            rgba(255,255,255,.17) ${value}%
        )
    `;

}


/* ============================================================
   05. SECONDARY VIDEO
============================================================ */

function initializeSecondaryVideo() {

    const video = elements.visual;

    if (!video) return;

    video.muted = true;
    video.defaultMuted = true;
    video.volume = 0;
    video.loop = true;
    video.playsInline = true;

    video.setAttribute("muted", "");
    video.setAttribute("playsinline", "");

    video.addEventListener("error", () => {

        console.warn(
            "ONEWAY: No se pudo cargar el video secundario."
        );

    });

    video.addEventListener("canplay", () => {

        startSecondaryVideo();

    }, { once: true });

    if (video.readyState >= 2) {
        startSecondaryVideo();
    }

}


async function startSecondaryVideo() {

    const video = elements.visual;

    if (!video || state.secondaryVideoStarted) return;

    try {

        video.muted = true;
        video.volume = 0;

        await video.play();

        state.secondaryVideoStarted = true;

    } catch (error) {

        state.secondaryVideoStarted = false;

    }

}


/* ============================================================
   06. AUDIO VISUAL ENGINE
============================================================ */

async function initializeAudioEngine() {

    if (state.audioContextReady) {

        if (state.audioContext?.state === "suspended") {
            await state.audioContext.resume();
        }

        return;

    }

    const AudioContextClass =
        window.AudioContext ||
        window.webkitAudioContext;

    if (!AudioContextClass) {

        console.warn(
            "ONEWAY: Web Audio API no disponible."
        );

        return;

    }

    try {

        state.audioContext = new AudioContextClass();

        state.analyser = state.audioContext.createAnalyser();

        state.analyser.fftSize = 512;
        state.analyser.smoothingTimeConstant = 0.82;
        state.analyser.minDecibels = -85;
        state.analyser.maxDecibels = -15;

        state.audioSource =
            state.audioContext.createMediaElementSource(
                elements.audio
            );

        state.audioSource.connect(state.analyser);

        state.analyser.connect(
            state.audioContext.destination
        );

        state.frequencyData = new Uint8Array(
            state.analyser.frequencyBinCount
        );

        state.audioContextReady = true;

        await state.audioContext.resume();

    } catch (error) {

        console.error(
            "ONEWAY Audio Engine:",
            error
        );

    }

}


/* ============================================================
   07. AUDIO PLAYBACK
============================================================ */

async function playMusic() {

    if (state.loading || state.playing) return;

    setLoading(true);

    try {

        await startSecondaryVideo();

        await initializeAudioEngine();

        synchronizeBackground(true);

        await elements.audio.play();

        if (
            elements.background.readyState >= 2 &&
            !elements.background.ended
        ) {
            elements.background.play().catch(() => {
                // Algunos navegadores retrasan el inicio hasta que el video tenga datos.
            });
        }

        state.playing = true;
        startBackgroundSync();

        elements.playerCard.classList.add("is-playing");

        elements.playButton.setAttribute(
            "aria-label",
            "Pausar"
        );

        elements.playButton.title = "Pausar";

        setPlaybackStatus("NOW PLAYING");

        elements.visualizerState.textContent = "LIVE AUDIO";

        startVisualizer();

        updateLyrics(true);

    } catch (error) {

        console.error(
            "ONEWAY Playback:",
            error
        );

        state.playing = false;

        elements.playerCard.classList.remove("is-playing");

        setPlaybackStatus("PLAYBACK ERROR");

    } finally {

        setLoading(false);

    }

}


function pauseMusic() {

    elements.audio.pause();
    elements.background.pause();

    state.playing = false;
    stopBackgroundSync();

    elements.playerCard.classList.remove("is-playing");

    elements.playButton.setAttribute(
        "aria-label",
        "Reproducir"
    );

    elements.playButton.title = "Reproducir";

    setPlaybackStatus("PLAYBACK PAUSED");

    elements.visualizerState.textContent = "STANDBY";

    stopVisualizer();

    drawIdleVisualizer();

}


function togglePlayback() {

    if (state.playing) {
        pauseMusic();
    } else {
        playMusic();
    }

}


/* ============================================================
   08. AUDIO EVENTS
============================================================ */

elements.audio.addEventListener("play", () => {

    state.playing = true;

    elements.playerCard.classList.add("is-playing");

    startVisualizer();
    startBackgroundSync();

});


elements.audio.addEventListener("pause", () => {

    state.playing = false;

    elements.background.pause();

    elements.playerCard.classList.remove("is-playing");

    stopVisualizer();
    stopBackgroundSync();

});


elements.audio.addEventListener("ended", () => {

    state.playing = false;

    elements.background.pause();

    elements.playerCard.classList.remove("is-playing");

    elements.visualizerState.textContent = "FINISHED";

    setPlaybackStatus("END OF SESSION");

    stopVisualizer();
    stopBackgroundSync();

    drawIdleVisualizer();

    elements.audio.currentTime = 0;

    synchronizeBackground(true);

    updateProgress();

    updateLyrics(true);

});


elements.audio.addEventListener("waiting", () => {

    if (state.playing) {
        setPlaybackStatus("BUFFERING");
    }

});


elements.audio.addEventListener("playing", () => {

    if (state.playing) {
        setPlaybackStatus("NOW PLAYING");
    }

});


elements.audio.addEventListener("loadedmetadata", () => {

    updateDuration();
    updateProgress();

});


elements.audio.addEventListener("durationchange", () => {

    updateDuration();

});


elements.audio.addEventListener("error", () => {

    setPlaybackStatus("AUDIO LOAD ERROR");

    console.error(
        "ONEWAY: No se pudo cargar musicatetto.mp3"
    );

});


/* ============================================================
   09. BACKGROUND VIDEO SYNCHRONIZATION
============================================================ */

function synchronizeBackground(force = false) {

    const audio = elements.audio;
    const video = elements.background;

    if (!video || !Number.isFinite(audio.currentTime)) return;

    if (video.readyState < 1 || video.seeking) return;

    const audioTime = audio.currentTime;
    const videoDuration = video.duration;

    let targetTime = audioTime;

    if (Number.isFinite(videoDuration)) {

        targetTime = Math.min(
            audioTime,
            Math.max(0, videoDuration - 0.04)
        );

    }

    const difference = targetTime - video.currentTime;
    const absoluteDifference = Math.abs(difference);

    if (
        force ||
        absoluteDifference > CONFIG.hardSyncTolerance
    ) {

        try {

            video.currentTime = targetTime;

        } catch (error) {

            console.warn(
                "ONEWAY: No se pudo ajustar el video.",
                error
            );

        }

        video.playbackRate = audio.playbackRate;

        return;

    }

    if (absoluteDifference > CONFIG.syncTolerance) {

        const correction = clamp(
            difference * 0.08,
            -0.035,
            0.035
        );

        video.playbackRate =
            audio.playbackRate * (1 + correction);

    } else {

        video.playbackRate = audio.playbackRate;

    }

}


function synchronizeBackgroundPlayback() {

    if (!state.playing) return;

    const video = elements.background;

    if (
        video.readyState >= 2 &&
        video.paused &&
        !video.ended
    ) {

        video.play().catch(() => {});

    }

}


elements.audio.addEventListener("seeking", () => {

    synchronizeBackground(true);

});


elements.audio.addEventListener("seeked", () => {

    synchronizeBackground(true);

    updateLyrics(true);

    updateProgress();

});


elements.audio.addEventListener("ratechange", () => {

    elements.background.playbackRate =
        elements.audio.playbackRate;

});


elements.background.addEventListener("loadedmetadata", () => {

    synchronizeBackground(true);

});


function backgroundSyncLoop(timestamp) {

    state.backgroundSyncFrame = null;

    if (
        state.destroyed ||
        !state.playing ||
        document.hidden
    ) {
        return;
    }

    if (timestamp - state.syncLastTime >= CONFIG.syncInterval) {

        synchronizeBackground();
        synchronizeBackgroundPlayback();

        state.syncLastTime = timestamp;

    }

    state.backgroundSyncFrame =
        requestAnimationFrame(backgroundSyncLoop);

}


function startBackgroundSync() {

    if (
        state.destroyed ||
        !state.playing ||
        document.hidden ||
        state.backgroundSyncFrame !== null
    ) {
        return;
    }

    state.syncLastTime = 0;

    state.backgroundSyncFrame =
        requestAnimationFrame(backgroundSyncLoop);

}


function stopBackgroundSync() {

    if (state.backgroundSyncFrame !== null) {

        cancelAnimationFrame(state.backgroundSyncFrame);

        state.backgroundSyncFrame = null;

    }

}


/* ============================================================
   10. PROGRESS BAR
============================================================ */

function updateDuration() {

    elements.duration.textContent = formatTime(
        elements.audio.duration
    );

}


function updateProgress() {

    const audio = elements.audio;

    const duration = audio.duration;
    const current = audio.currentTime;

    if (!Number.isFinite(duration) || duration <= 0) {

        elements.progressFill.style.width = "0%";

        elements.currentTime.textContent = "00:00";

        return;

    }

    const percentage = clamp(
        (current / duration) * 100,
        0,
        100
    );

    elements.progressFill.style.width =
        `${percentage}%`;

    elements.currentTime.textContent =
        formatTime(current);

    elements.duration.textContent =
        formatTime(duration);

    elements.progressTrack.setAttribute(
        "aria-valuenow",
        percentage.toFixed(1)
    );

}


function seekToPosition(event) {

    const track = elements.progressTrack;

    const rect = track.getBoundingClientRect();

    const percentage = clamp(
        (event.clientX - rect.left) / rect.width,
        0,
        1
    );

    const duration = elements.audio.duration;

    if (!Number.isFinite(duration)) return;

    elements.audio.currentTime =
        percentage * duration;

    synchronizeBackground(true);

    updateProgress();

    updateLyrics(true);

}


elements.progressTrack.addEventListener("pointerdown", (event) => {

    if (!Number.isFinite(elements.audio.duration)) return;

    state.seeking = true;

    elements.progressTrack.setPointerCapture(event.pointerId);

    seekToPosition(event);

});


elements.progressTrack.addEventListener("pointermove", (event) => {

    if (!state.seeking) return;

    seekToPosition(event);

});


elements.progressTrack.addEventListener("pointerup", () => {

    state.seeking = false;

});


elements.progressTrack.addEventListener("pointercancel", () => {

    state.seeking = false;

});


elements.progressTrack.addEventListener("keydown", (event) => {

    if (event.key === "ArrowRight") {

        event.preventDefault();

        seekBy(5);

    }

    if (event.key === "ArrowLeft") {

        event.preventDefault();

        seekBy(-5);

    }

});


/* ============================================================
   11. SEEK CONTROLS
============================================================ */

function seekBy(seconds) {

    const audio = elements.audio;

    if (!Number.isFinite(audio.duration)) return;

    audio.currentTime = clamp(
        audio.currentTime + seconds,
        0,
        audio.duration
    );

    synchronizeBackground(true);

    updateProgress();

    updateLyrics(true);

}


elements.forwardButton.addEventListener("click", () => {

    seekBy(CONFIG.seekStep);

});


elements.backwardButton.addEventListener("click", () => {

    seekBy(-CONFIG.seekStep);

});


/* ============================================================
   12. VOLUME SYSTEM
============================================================ */

function setVolume(value) {

    const volume = clamp(
        Number(value),
        0,
        1
    );

    elements.audio.volume = volume;

    elements.volumeSlider.value = volume;

    state.muted = volume === 0;

    if (volume > 0) {
        state.previousVolume = volume;
    }

    updateVolumeAppearance();

    updateMuteIcon();

}


function toggleMute() {

    if (state.muted || elements.audio.volume === 0) {

        const restoreVolume =
            state.previousVolume || CONFIG.defaultVolume;

        setVolume(restoreVolume);

    } else {

        state.previousVolume = elements.audio.volume;

        setVolume(0);

    }

}


function updateMuteIcon() {

    const muted = state.muted;

    elements.muteButton.setAttribute(
        "aria-label",
        muted ? "Activar sonido" : "Silenciar"
    );

    elements.muteButton.title =
        muted ? "Activar sonido" : "Silenciar";

    if (muted) {

        elements.muteButton.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none">
                <path d="M4 10V14H8L13 18V6L8 10H4Z"
                    stroke="currentColor"
                    stroke-width="1.7"
                    stroke-linejoin="round"/>
                <path d="M17 9L22 15M22 9L17 15"
                    stroke="currentColor"
                    stroke-width="1.7"
                    stroke-linecap="round"/>
            </svg>
        `;

    } else {

        elements.muteButton.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none">
                <path d="M4 10V14H8L13 18V6L8 10H4Z"
                    stroke="currentColor"
                    stroke-width="1.7"
                    stroke-linejoin="round"/>
                <path d="M17 9C18.5 10.5 18.5 13.5 17 15"
                    stroke="currentColor"
                    stroke-width="1.7"
                    stroke-linecap="round"/>
                <path d="M19 6C22 9 22 15 19 18"
                    stroke="currentColor"
                    stroke-width="1.7"
                    stroke-linecap="round"/>
            </svg>
        `;

    }

}


elements.volumeSlider.addEventListener("input", (event) => {

    setVolume(event.target.value);

});


elements.muteButton.addEventListener("click", toggleMute);


/* ============================================================
   13. LRC LYRICS ENGINE
============================================================ */

function parseLRC(content) {

    const lines = content.replace(/\r/g, "").split("\n");

    const result = [];

    let offset = 0;

    const metadata = {};

    // CORREGIDO: reconocimiento de centésimas y milésimas.
    const timestampRegex =
        /\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g;

    for (const rawLine of lines) {

        const line = rawLine.trim();

        if (!line) continue;

        const metadataMatch = line.match(
            /^\[([a-z]+):([^\]]*)\]$/i
        );

        if (metadataMatch) {

            const key = metadataMatch[1].toLowerCase();

            const value = metadataMatch[2].trim();

            if (key === "offset") {

                const parsedOffset = Number(value);

                if (Number.isFinite(parsedOffset)) {
                    offset = parsedOffset / 1000;
                }

            } else {

                metadata[key] = value;

            }

            continue;

        }

        const timestamps = [];

        let match;

        timestampRegex.lastIndex = 0;

        while ((match = timestampRegex.exec(line)) !== null) {

            const minutes = Number(match[1]);

            const seconds = Number(match[2]);

            const fraction = match[3] || "0";

            const milliseconds = Number(
                fraction.padEnd(3, "0").slice(0, 3)
            );

            const time =
                minutes * 60 +
                seconds +
                milliseconds / 1000;

            timestamps.push(time);

        }

        if (timestamps.length === 0) continue;

        const lyric = line
            .replace(timestampRegex, "")
            .trim();

        timestamps.forEach(time => {

            result.push({

                time: Math.max(0, time + offset),

                text: lyric

            });

        });

    }

    result.sort((a, b) => a.time - b.time);

    return {
        lyrics: result,
        metadata,
        offset
    };

}


/* ============================================================
   14. LOAD LRC FILE
============================================================ */

async function loadLyrics() {

    try {

        elements.lyricsStatus.textContent =
            "LOADING LYRICS";

        const response = await fetch(CONFIG.lyrics, {
            cache: "no-cache"
        });

        if (!response.ok) {

            throw new Error(
                `HTTP ${response.status}`
            );

        }

        const content = await response.text();

        const parsed = parseLRC(content);

        state.lyrics = parsed.lyrics;

        state.lyricOffset = parsed.offset;

        if (parsed.metadata.ti) {

            elements.trackTitle.textContent =
                parsed.metadata.ti;

        }

        if (parsed.metadata.ar) {

            elements.trackArtist.textContent =
                parsed.metadata.ar;

        }

        if (state.lyrics.length > 0) {

            elements.lyricsStatus.textContent =
                "LYRICS SYNCHRONIZED";

            updateLyrics(true);

        } else {

            elements.lyricsStatus.textContent =
                "NO TIMED LYRICS FOUND";

        }

    } catch (error) {

        console.warn(
            "ONEWAY LRC Engine:",
            error
        );

        elements.lyricsStatus.textContent =
            "LYRICS FILE UNAVAILABLE";

        elements.currentLyric.textContent =
            "Lyrics will appear here.";

    }

}


/* ============================================================
   15. LYRICS TIMELINE
============================================================ */

function findCurrentLyric(time) {

    const lyrics = state.lyrics;

    let left = 0;
    let right = lyrics.length - 1;

    let result = -1;

    while (left <= right) {

        const middle = Math.floor(
            (left + right) / 2
        );

        if (lyrics[middle].time <= time) {

            result = middle;

            left = middle + 1;

        } else {

            right = middle - 1;

        }

    }

    return result;

}


/* ============================================================
   16. LYRICS RENDERING
============================================================ */

function updateLyrics(force = false) {

    if (state.lyrics.length === 0) return;

    const currentTime = elements.audio.currentTime;

    const index = findCurrentLyric(currentTime);

    if (!force && index === state.lyricIndex) return;

    state.lyricIndex = index;

    const previous = state.lyrics[index - 1];

    const current = state.lyrics[index];

    const next = state.lyrics[index + 1];

    elements.previousLyric.textContent =
        previous?.text || "";

    elements.currentLyric.textContent =
        current?.text || "♪";

    elements.nextLyric.textContent =
        next?.text || "";

    if (index < 0) {

        elements.currentLyric.textContent =
            "The story begins here...";

        elements.lyricsStatus.textContent =
            "WAITING FOR PLAYBACK";

    } else {

        elements.lyricsStatus.textContent =
            "LYRICS SYNCHRONIZED";

    }

    animateLyrics();

}


/* ============================================================
   17. CHARACTER BY CHARACTER ANIMATION
============================================================ */

function animateLyrics() {

    const display = elements.lyricsDisplay;

    const currentElement = elements.currentLyric;

    clearTimeout(state.lyricTransitionTimer);

    display.classList.remove("is-transitioning");

    currentElement.classList.remove("typing-active");

    const index = state.lyricIndex;

    const current = state.lyrics[index];

    const next = state.lyrics[index + 1];

    const text = currentElement.textContent || "";

    // Si todavía no hay letra, mostramos el texto normal.
    if (!current || index < 0 || !text || text === "♪") {

        currentElement.textContent = text;

        display.classList.add("is-transitioning");

        return;

    }

    // Tiempo transcurrido desde que comenzó la frase.
    // Tiempo disponible antes de la siguiente frase.
const remainingTime = next
    ? Math.max(500, (next.time - elements.audio.currentTime) * 1000)
    : 4000;

    // Separamos el texto en caracteres Unicode.
    const characterDelay = clamp(
    (remainingTime * 0.68) /
        Math.max(characters.length, 1),
    CONFIG.lyricTypingMinSpeed,
    CONFIG.lyricTypingMaxSpeed
);

    const fragment = document.createDocumentFragment();

    characters.forEach((character, i) => {

        const span = document.createElement("span");

        span.className = "lyric-character";

        span.textContent = character === " "
            ? "\u00A0"
            : character;

        // Ajuste según el tiempo real de reproducción.
        const delay = i * characterDelay;

        span.style.setProperty(
            "--char-delay",
            `${delay}ms`
        );

        span.style.setProperty(
            "--char-duration",
            `${CONFIG.lyricCharacterDuration}ms`
        );

        fragment.appendChild(span);

    });

    // Insertamos todos los caracteres de una sola vez.
    currentElement.replaceChildren(fragment);

    // Reiniciamos la transición visual.
    display.classList.remove("is-transitioning");

    void display.offsetWidth;

    display.classList.add("is-transitioning");

    currentElement.classList.add("typing-active");

    state.lyricTransitionTimer = setTimeout(() => {

        currentElement.classList.remove("typing-active");

    }, CONFIG.lyricTransitionDuration);

}


/* ============================================================
   18. LYRICS VISIBILITY
============================================================ */

elements.lyricsToggle.addEventListener("click", () => {

    const hidden =
        elements.lyricsContainer.classList.toggle("is-hidden");

    elements.lyricsToggle.setAttribute(
        "aria-label",
        hidden ? "Mostrar letras" : "Ocultar letras"
    );

    elements.lyricsToggle.title =
        hidden ? "Mostrar letras" : "Ocultar letras";

});


/* ============================================================
   19. AUDIO VISUALIZER CANVAS
============================================================ */

const canvas = elements.visualizer;

const ctx = canvas.getContext("2d", {
    alpha: true
});

let canvasWidth = 0;
let canvasHeight = 0;

let visualizerGradient = null;


function resizeVisualizer() {

    if (!canvas || !ctx) return;

    const rect = canvas.getBoundingClientRect();

    const dpr = Math.min(
        window.devicePixelRatio || 1,
        CONFIG.maxDpr
    );

    canvasWidth = rect.width;
    canvasHeight = rect.height;

    const pixelWidth = Math.round(canvasWidth * dpr);
    const pixelHeight = Math.round(canvasHeight * dpr);

    // Resizing a canvas clears it and reallocates its backing store.
    // Only do that when its actual pixel dimensions changed.
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
    }

    ctx.setTransform(
        dpr, 0, 0, dpr, 0, 0
    );

    visualizerGradient = ctx.createLinearGradient(
        0,
        canvasHeight,
        0,
        0
    );

    visualizerGradient.addColorStop(
        0,
        "rgba(135, 217, 232, .45)"
    );

    visualizerGradient.addColorStop(
        0.45,
        "rgba(180, 154, 255, .9)"
    );

    visualizerGradient.addColorStop(
        1,
        "rgba(231, 211, 255, .95)"
    );

    drawIdleVisualizer();

}


function drawIdleVisualizer() {

    if (!ctx || !canvasWidth) return;

    ctx.clearRect(
        0,
        0,
        canvasWidth,
        canvasHeight
    );

    const bars = CONFIG.visualizerBars;

    const gap = 4;

    const barWidth = Math.max(
        2,
        (canvasWidth - gap * (bars - 1)) / bars
    );

    const center = canvasHeight / 2;

    for (let i = 0; i < bars; i++) {

        const wave =
            Math.sin(i * 0.28) * 0.5 +
            Math.sin(i * 0.12) * 0.3;

        const height = 4 + Math.abs(wave) * 7;

        const x = i * (barWidth + gap);

        ctx.fillStyle =
            "rgba(180, 154, 255, .32)";

        ctx.beginPath();

        ctx.roundRect(
            x,
            center - height / 2,
            barWidth,
            height,
            3
        );

        ctx.fill();

    }

}


/* ============================================================
   20. VISUALIZER DRAWING
============================================================ */

function drawVisualizer() {

    if (
        !ctx ||
        !state.analyser ||
        !state.frequencyData ||
        !canvasWidth
    ) return;

    state.analyser.getByteFrequencyData(
        state.frequencyData
    );

    ctx.clearRect(
        0,
        0,
        canvasWidth,
        canvasHeight
    );

    const bars = CONFIG.visualizerBars;

    const gap = 4;

    const barWidth =
        (canvasWidth - gap * (bars - 1)) / bars;

    const center = canvasHeight / 2;

    const maxHeight = canvasHeight * 0.9;

    ctx.fillStyle = visualizerGradient;

    for (let i = 0; i < bars; i++) {

        const dataIndex = Math.floor(
            Math.pow(i / bars, 1.65) *
            (state.frequencyData.length - 1)
        );

        const frequency =
            state.frequencyData[dataIndex] / 255;

        const height = Math.max(
            3,
            frequency *
            maxHeight *
            CONFIG.visualizerSensitivity
        );

        const x = i * (barWidth + gap);

        ctx.beginPath();

        ctx.roundRect(
            x,
            center - height / 2,
            barWidth,
            height,
            4
        );

        ctx.fill();

    }

}


/* ============================================================
   21. VISUALIZER ANIMATION LOOP
============================================================ */

function visualizerLoop(timestamp) {

    if (!state.playing || state.destroyed || document.hidden) {

        state.visualizerFrame = null;

        return;

    }

    const frameInterval =
        1000 / CONFIG.visualizerFPS;

    if (
        timestamp - state.visualizerLastFrame >= frameInterval
    ) {

        drawVisualizer();

        state.visualizerLastFrame = timestamp;

    }

    state.visualizerFrame =
        requestAnimationFrame(visualizerLoop);

}


function startVisualizer() {

    if (
        !state.audioContextReady ||
        !state.analyser ||
        document.hidden
    ) {
        return;
    }

    if (state.visualizerFrame !== null) return;

    state.visualizerLastFrame = 0;

    state.visualizerFrame =
        requestAnimationFrame(visualizerLoop);

}


function stopVisualizer() {

    if (state.visualizerFrame !== null) {

        cancelAnimationFrame(
            state.visualizerFrame
        );

        state.visualizerFrame = null;

    }

}



/* ============================================================
   24. PAGE VISIBILITY / RESOURCE MANAGEMENT
============================================================ */

document.addEventListener("visibilitychange", () => {

    if (document.hidden) {

        stopVisualizer();
        stopBackgroundSync();

        // Keep the audio running, but stop decoding the background video
        // while the tab is not visible.
        elements.background.pause();

        return;

    }

    if (state.playing) {

        synchronizeBackground(true);

        if (elements.background.readyState >= 2) {
            elements.background.play().catch(() => {});
        }

        startBackgroundSync();
        startVisualizer();

    } else {

        drawIdleVisualizer();

    }

});

/* ============================================================
   22. KEYBOARD SHORTCUTS
============================================================ */

document.addEventListener("keydown", (event) => {

    const target = event.target;

    const isTyping =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target.isContentEditable;

    if (isTyping) return;

    switch (event.code) {

        case "Space":

            event.preventDefault();

            togglePlayback();

            break;

        case "ArrowRight":

            event.preventDefault();

            seekBy(CONFIG.seekStep);

            break;

        case "ArrowLeft":

            event.preventDefault();

            seekBy(-CONFIG.seekStep);

            break;

        case "ArrowUp":

            event.preventDefault();

            setVolume(
                elements.audio.volume + 0.05
            );

            break;

        case "ArrowDown":

            event.preventDefault();

            setVolume(
                elements.audio.volume - 0.05
            );

            break;

        case "KeyM":

            toggleMute();

            break;

        case "KeyL":

            elements.lyricsToggle.click();

            break;

    }

});


/* ============================================================
   23. LIGHTWEIGHT MEDIA UI UPDATES
   The browser emits timeupdate while the audio timeline advances.
   This avoids a permanent animation-frame loop just to refresh text.
============================================================ */

elements.audio.addEventListener("timeupdate", () => {

    if (!state.seeking) {
        updateProgress();
    }

    if (state.playing) {
        updateLyrics();
    }

});


/* ============================================================
   24. BUTTON CONNECTIONS
============================================================ */

elements.playButton.addEventListener(
    "click",
    togglePlayback
);


/* ============================================================
   25. INITIALIZATION
============================================================ */

function initializeONEWAY() {

    console.log(
        "%c ONEWAY ",
        "background:#171321;color:#d8caff;padding:8px 14px;font-weight:bold;"
    );

    console.log(
        "Cinematic Music Experience | Audio Engine Ready"
    );


    // Audio

    elements.audio.volume = CONFIG.defaultVolume;

    elements.audio.preload = "metadata";

    elements.audio.muted = false;


    // Background video

    elements.background.muted = true;

    elements.background.defaultMuted = true;

    elements.background.pause();

    elements.background.playsInline = true;


    // Secondary video

    initializeSecondaryVideo();


    // Controls

    updateVolumeAppearance();

    updateMuteIcon();

    updateDuration();

    updateProgress();


    // Canvas

    resizeVisualizer();

    drawIdleVisualizer();


    // Lyrics

    loadLyrics();


    // Background synchronization starts only when audio playback starts.


    // Canvas resize

    if ("ResizeObserver" in window) {

        const observer = new ResizeObserver(() => {

            resizeVisualizer();

        });

        observer.observe(canvas);

    } else {

        window.addEventListener(
            "resize",
            resizeVisualizer,
            { passive: true }
        );

    }


    // Initial status

    setPlaybackStatus("READY TO PLAY");

    elements.visualizerState.textContent = "STANDBY";

}


if (document.readyState === "loading") {

    document.addEventListener(
        "DOMContentLoaded",
        initializeONEWAY,
        { once: true }
    );

} else {

    initializeONEWAY();

}
