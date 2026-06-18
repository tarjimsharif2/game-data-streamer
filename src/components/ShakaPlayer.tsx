import React, { useEffect, useRef, useState, useCallback } from "react";
import { RefreshCw, AlertCircle, ArrowLeft } from "lucide-react";
import shakaUiScriptUrl from "shaka-player/dist/shaka-player.ui.js?url";
import shakaControlsCssUrl from "shaka-player/dist/controls.css?url";

declare global {
  interface Window {
    shaka: any;
  }
}

let shakaLoadPromise: Promise<any> | null = null;

function loadShakaLibrary(): Promise<any> {
  if (typeof window === "undefined") {
    return Promise.reject(
      new Error("Shaka Player can only load in the browser"),
    );
  }

  if (window.shaka?.Player && window.shaka?.ui?.Overlay) {
    return Promise.resolve(window.shaka);
  }

  if (shakaLoadPromise) return shakaLoadPromise;

  shakaLoadPromise = new Promise((resolve, reject) => {
    const existingCss = document.querySelector<HTMLLinkElement>(
      'link[data-shaka-controls="true"]',
    );
    if (!existingCss) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = shakaControlsCssUrl;
      link.dataset.shakaControls = "true";
      document.head.appendChild(link);
    }

    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[data-shaka-player="true"]',
    );
    if (existingScript) {
      if (window.shaka?.Player && window.shaka?.ui?.Overlay) {
        resolve(window.shaka);
        return;
      }
      existingScript.addEventListener("load", () => resolve(window.shaka), {
        once: true,
      });
      existingScript.addEventListener(
        "error",
        () => reject(new Error("Failed to load Shaka Player library")),
        { once: true },
      );
      return;
    }

    const script = document.createElement("script");
    script.src = shakaUiScriptUrl;
    script.async = true;
    script.dataset.shakaPlayer = "true";
    script.onload = () => {
      if (window.shaka?.Player && window.shaka?.ui?.Overlay) {
        resolve(window.shaka);
      } else {
        reject(new Error("Shaka Player UI failed to initialize"));
      }
    };
    script.onerror = () =>
      reject(new Error("Failed to load Shaka Player library"));
    document.head.appendChild(script);
  }).catch((error) => {
    shakaLoadPromise = null;
    throw error;
  });

  return shakaLoadPromise;
}

interface ShakaPlayerProps {
  src: string;
  type?: string;
  title?: string;
  headers?: Record<string, string>;
  drm?: any;
  onErrorFallback?: () => void;
}

export const ShakaPlayer = ({
  src,
  type,
  title,
  headers = {},
  drm,
  onErrorFallback,
}: ShakaPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const uiRef = useRef<any>(null);
  const initIdRef = useRef(0);
  const destroyingPromiseRef = useRef<Promise<void> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const onErrorFallbackRef = useRef(onErrorFallback);

  useEffect(() => {
    onErrorFallbackRef.current = onErrorFallback;
  }, [onErrorFallback]);

  const jumpToLiveEdge = useCallback((video: HTMLVideoElement) => {
    if (video.seekable.length > 0) {
      const liveEdge = video.seekable.end(0);
      video.currentTime = Math.max(0, liveEdge - 0.5);
    }
  }, []);

  const headersStr = JSON.stringify(headers || {});
  const drmStr = JSON.stringify(drm || null);

  const initPlayer = useCallback(async () => {
    const currentInitId = ++initIdRef.current;

    setError(null);
    setIsLoading(true);

    let shaka: any;
    try {
      shaka = await loadShakaLibrary();
    } catch (err: any) {
      if (currentInitId !== initIdRef.current) return;
      setError(err?.message || "Shaka Player library not loaded");
      setIsLoading(false);
      return;
    }

    if (currentInitId !== initIdRef.current) return;

    if (destroyingPromiseRef.current) {
      await destroyingPromiseRef.current;
    }

    const cleanupPromises: Promise<void>[] = [];
    if (uiRef.current) {
      const uiToDestroy = uiRef.current;
      uiRef.current = null;
      try {
        const p = uiToDestroy.destroy?.();
        if (p) cleanupPromises.push(p.catch(() => {}));
      } catch (e) {}
    }

    if (playerRef.current) {
      const playerToDestroy = playerRef.current;
      playerRef.current = null;
      try {
        const p = playerToDestroy.destroy();
        if (p) cleanupPromises.push(p.catch(() => {}));
      } catch (e) {}
    }

    if (cleanupPromises.length > 0) {
      const p = Promise.all(cleanupPromises).then(() => {});
      destroyingPromiseRef.current = p;
      await p;
      destroyingPromiseRef.current = null;
    }

    shaka.polyfill.installAll();

    if (!shaka.Player.isBrowserSupported()) {
      if (currentInitId !== initIdRef.current) return;
      setError("Your browser does not support this player");
      setIsLoading(false);
      return;
    }

    const video = videoRef.current;
    const container = containerRef.current;
    if (!video || !container) return;

    try {
      const parsedHeaders = JSON.parse(headersStr);
      const parsedDrm = JSON.parse(drmStr);

      const player = new shaka.Player();
      playerRef.current = player;

      const attachPromise = player.attach(video);
      await attachPromise;

      if (currentInitId !== initIdRef.current) {
        return;
      }

      const apiUrl = import.meta.env.VITE_API_URL || "";

      player
        .getNetworkingEngine()
        .registerRequestFilter((type: any, request: any) => {
          if (type === shaka.net.NetworkingEngine.RequestType.LICENSE) {
            if (parsedHeaders) {
              for (const [k, v] of Object.entries(parsedHeaders)) {
                request.headers[k] = v;
              }
            }
            return;
          }

          if (!request.uris || request.uris.length === 0) return;

          request.uris = request.uris.map((originalUri: string) => {
            console.log("[Shaka Request]", originalUri);
            return originalUri;
          });
        });

      player
        .getNetworkingEngine()
        .registerResponseFilter((type: any, response: any) => {
          console.log(
            "[Shaka Response]",
            response.uri,
            response.data && response.data.byteLength,
          );
        });

      const ui = new shaka.ui.Overlay(player, container, video);
      uiRef.current = ui;
      ui.configure({
        controlPanelElements: [
          "play_pause",
          "time_and_duration",
          "mute",
          "volume",
          "spacer",
          "language",
          "captions",
          "picture_in_picture",
          "quality",
          "fullscreen",
        ],
        seekBarColors: {
          base: "rgba(255, 255, 255, 0.3)",
          buffered: "rgba(255, 255, 255, 0.5)",
          played: "var(--primary)",
        },
      });

      let playerConfig: any = {
        streaming: {
          lowLatencyMode: true,
          bufferingGoal: 10,
          rebufferingGoal: 2,
          bufferBehind: 15,
          stallEnabled: true,
          stallThreshold: 1,
          stallSkip: 0.5,
          retryParameters: {
            timeout: 10000,
            maxAttempts: 5,
            baseDelay: 300,
            backoffFactor: 1.2,
          },
          ignoreTextStreamFailures: true,
        },
        manifest: {
          dash: {
            ignoreMinBufferTime: true,
          },
          retryParameters: {
            timeout: 8000,
            maxAttempts: 3,
          },
        },
      };

      let clearKeys: any = null;
      let licenseServerUrl: string | null = null;

      if (parsedDrm && typeof parsedDrm === "object") {
        if (Array.isArray(parsedDrm)) {
          clearKeys = {};
          parsedDrm.forEach((k: any) => {
            if (k.keyId && k.key) clearKeys[k.keyId] = k.key;
            else if (k.kid && k.key) clearKeys[k.kid] = k.key;
          });
        } else if (
          parsedDrm.clearKeys &&
          Object.keys(parsedDrm.clearKeys).length > 0
        ) {
          clearKeys = parsedDrm.clearKeys;
        } else if (parsedDrm.keyId && parsedDrm.key) {
          clearKeys = { [parsedDrm.keyId]: parsedDrm.key };
        } else if (parsedDrm.kid && parsedDrm.key) {
          clearKeys = { [parsedDrm.kid]: parsedDrm.key };
        }
      } else if (parsedDrm && typeof parsedDrm === "string") {
        if (
          parsedDrm.startsWith("http://") ||
          parsedDrm.startsWith("https://")
        ) {
          licenseServerUrl = parsedDrm;
        } else {
          const parts = parsedDrm.split(":");
          if (parts.length === 2 && !parsedDrm.includes("//")) {
            clearKeys = { [parts[0]]: parts[1] };
          }
        }
      }

      const headerDrmKey = (parsedHeaders as any).drmKey;
      if (
        headerDrmKey &&
        typeof headerDrmKey === "string" &&
        !clearKeys &&
        !licenseServerUrl
      ) {
        if (
          headerDrmKey.startsWith("http://") ||
          headerDrmKey.startsWith("https://")
        ) {
          licenseServerUrl = headerDrmKey;
        } else {
          const parts = headerDrmKey.split(":");
          if (parts.length === 2 && !headerDrmKey.includes("//")) {
            clearKeys = { [parts[0]]: parts[1] };
          }
        }
      }

      if (clearKeys) {
        playerConfig.drm = {
          clearKeys: clearKeys,
          preferredKeySystems: ["org.w3.clearkey"],
        };
      } else if (licenseServerUrl) {
        playerConfig.drm = {
          servers: {
            "com.widevine.alpha": licenseServerUrl,
            "com.microsoft.playready": licenseServerUrl,
          },
        };
      }

      player.configure(playerConfig);

      player.addEventListener("error", (event: any) => {
        console.error("Shaka Player Error:", event.detail);

        let errorMsg = "Stream playback error";
        let logData = { code: event.detail?.code, url: "", status: "" };

        if (event.detail && event.detail.code) {
          const code = event.detail.code;

          if (code === 1001) {
            errorMsg =
              "Stream is currently offline or unreachable (Error 1001).";
          } else if (code === 1002) {
            errorMsg =
              "Network connection failed. The stream might be blocked by CORS or adblockers (Error 1002).";
          } else if (code === 6012) {
            errorMsg =
              "DRM License request failed. The stream key might be expired (Error 6012).";
          } else {
            errorMsg = `Stream playback error (Code: ${code})`;
          }

          if (
            (code === 6012 || code === 1001) &&
            event.detail.data &&
            event.detail.data.length >= 2
          ) {
            errorMsg += `\nHTTP ${event.detail.data[1]}`;
            logData.url = event.detail.data[0];
            logData.status = event.detail.data[1];
          } else if (event.detail.data && event.detail.data.length > 0) {
            let dataStr = "";
            if (event.detail.data[0] instanceof Error) {
              dataStr = event.detail.data[0].message;
            } else if (typeof event.detail.data[0] === "string") {
              dataStr = event.detail.data[0];
            } else {
              dataStr = (event.detail.data[1] || "").toString();
            }
            if (dataStr && !dataStr.startsWith("http")) {
              errorMsg += "\nDetails: " + dataStr;
            }
          }
        }

        const apiUrl = import.meta.env.VITE_API_URL || "";
        fetch(`${apiUrl}/api/log`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            error: errorMsg,
            details: logData,
            title,
            src,
          }),
        }).catch((e) => {});

        setError(errorMsg);
        setIsLoading(false);
        if (onErrorFallbackRef.current) onErrorFallbackRef.current();
      });

      const syncToLiveEdge = () => {
        if (player.isLive()) {
          const seekRange = player.seekRange();
          const liveEdge = seekRange.end;
          if (liveEdge - video.currentTime > 7) {
            video.currentTime = liveEdge - 2;
          }
        }
      };

      video.addEventListener("play", syncToLiveEdge);
      video.addEventListener("playing", syncToLiveEdge);

      if ((video as any)._shakaSyncListener) {
        video.removeEventListener("play", (video as any)._shakaSyncListener);
        video.removeEventListener(
          "playing",
          (video as any)._shakaSyncListener,
        );
      }
      (video as any)._shakaSyncListener = syncToLiveEdge;

      const mimeType =
        type === "dash"
          ? "application/dash+xml"
          : type === "hls"
            ? "application/x-mpegURL"
            : undefined;
      await player.load(src, undefined, mimeType);

      if (currentInitId !== initIdRef.current) return;

      video.muted = true;
      try {
        await video.play();
        video.muted = false;
      } catch {
        video.muted = true;
        try {
          await video.play();
        } catch (playErr) {
          console.warn("Autoplay blocked:", playErr);
        }
      }

      setIsLoading(false);
      console.log(`✅ Shaka loaded: ${title || src}`);
    } catch (err: any) {
      if (currentInitId !== initIdRef.current) return;
      console.error("Shaka init error:", err);
      setError(err?.message || "Failed to load stream");
      setIsLoading(false);
      if (onErrorFallbackRef.current) onErrorFallbackRef.current();
    }
  }, [src, title, headersStr, drmStr]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const syncInterval = setInterval(() => {
      const player = playerRef.current;
      if (player && player.isLive() && !video.paused) {
        const seekRange = player.seekRange();
        const liveEdge = seekRange.end;

        if (liveEdge - video.currentTime > 7) {
          console.log(
            `[Shaka sync] Delay is ${Math.round(liveEdge - video.currentTime)}s. Snapping to live edge.`,
          );
          video.currentTime = liveEdge - 2;
        }
      }
    }, 2000);

    return () => {
      clearInterval(syncInterval);
    };
  }, []);

  useEffect(() => {
    initPlayer();

    return () => {
      initIdRef.current++;
      const promises: Promise<void>[] = [];

      if (uiRef.current) {
        const uiToDestroy = uiRef.current;
        uiRef.current = null;
        try {
          const p = uiToDestroy.destroy?.();
          if (p) promises.push(p.catch(() => {}));
        } catch (e) {}
      }
      if (playerRef.current) {
        const playerToDestroy = playerRef.current;
        playerRef.current = null;
        try {
          const p = playerToDestroy.destroy();
          if (p) promises.push(p.catch(() => {}));
        } catch (e) {}
      }

      const video = videoRef.current;
      if (video && (video as any)._shakaSyncListener) {
        video.removeEventListener("play", (video as any)._shakaSyncListener);
        video.removeEventListener(
          "playing",
          (video as any)._shakaSyncListener,
        );
        delete (video as any)._shakaSyncListener;
      }

      if (promises.length > 0) {
        destroyingPromiseRef.current = Promise.all(promises).then(() => {
          destroyingPromiseRef.current = null;
        });
      }
    };
  }, [initPlayer]);

  return (
    <div className="relative w-full h-full bg-black">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center z-50 bg-black pointer-events-none">
          <div className="w-10 h-10 border-4 border-white/20 border-t-white rounded-full animate-spin" />
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center z-30 bg-black/95">
          <div className="text-center text-white max-w-sm px-4">
            <AlertCircle className="w-12 h-12 mx-auto mb-3 text-red-500" />
            <p className="text-sm mb-4">{error}</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={initPlayer}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-md text-sm font-medium transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Retry
              </button>
            </div>
          </div>
        </div>
      )}

      <div
        ref={containerRef}
        className="absolute inset-0 w-full h-full shaka-video-container"
        data-shaka-player
      >
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          preload="metadata"
          className="w-full h-full bg-black object-fill"
          style={{ width: "100%", height: "100%" }}
        />

        <div className="absolute top-4 right-4 z-[99999] pointer-events-none custom-overlay">
          <img
            src="https://i.ibb.co/Q3rp8ZXs/20260203-180035-0000.png"
            alt="Stream Watermark"
            className="h-10 sm:h-14 md:h-16 lg:h-20 w-auto object-contain drop-shadow-[0_2px_12px_rgba(0,0,0,0.95)] opacity-85 hover:opacity-100 transition-opacity duration-300"
          />
        </div>
      </div>
    </div>
  );
};