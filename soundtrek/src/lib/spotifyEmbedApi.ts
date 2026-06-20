let promise: Promise<any> | null = null;

export function getSpotifyIFrameAPI(): Promise<any> {
  const w = window as any;
  if (w.__SpotifyIFrameAPI) return Promise.resolve(w.__SpotifyIFrameAPI);
  if (promise) return promise;
  promise = new Promise((resolve) => {
    w.onSpotifyIframeApiReady = (api: any) => {
      w.__SpotifyIFrameAPI = api;
      resolve(api);
    };
    if (!document.querySelector('script[src*="spotify.com/embed/iframe-api"]')) {
      const script = document.createElement("script");
      script.src = "https://open.spotify.com/embed/iframe-api/v1";
      script.async = true;
      document.head.appendChild(script);
    }
  });
  return promise;
}
