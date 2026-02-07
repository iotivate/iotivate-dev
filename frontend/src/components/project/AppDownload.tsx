"use client";

interface AppDownloadProps {
  name: string;
  description?: string;
  playStoreUrl?: string;
  apkUrl?: string;
  apkVersion?: string;
  apkSize?: string;
  iosUrl?: string;
  features?: string[];
}

export default function AppDownload({
  name,
  description,
  playStoreUrl,
  apkUrl,
  apkVersion,
  apkSize,
  iosUrl,
  features = [],
}: AppDownloadProps) {
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="px-4 py-3 bg-surface border-b border-border">
        <h3 className="font-semibold">Companion App</h3>
      </div>

      <div className="p-4 space-y-4">
        {/* App info */}
        <div>
          <h4 className="font-medium mb-1">{name}</h4>
          {description && <p className="text-sm text-muted">{description}</p>}
        </div>

        {/* Features */}
        {features.length > 0 && (
          <ul className="text-sm text-muted space-y-1">
            {features.map((feature, index) => (
              <li key={index} className="flex items-start gap-2">
                <svg className="w-4 h-4 text-accent shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {feature}
              </li>
            ))}
          </ul>
        )}

        {/* Download buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Google Play */}
          {playStoreUrl && (
            <a
              href={playStoreUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-4 py-2.5 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
            >
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 01-.61-.92V2.734a1 1 0 01.609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-3.198l2.807 1.626a1 1 0 010 1.73l-2.808 1.626L15.206 12l2.492-2.491zM5.864 2.658L16.8 8.99l-2.302 2.302-8.634-8.634z" />
              </svg>
              <div className="text-left">
                <div className="text-[10px] opacity-80">GET IT ON</div>
                <div className="text-sm font-medium -mt-0.5">Google Play</div>
              </div>
            </a>
          )}

          {/* App Store */}
          {iosUrl && (
            <a
              href={iosUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-4 py-2.5 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
            >
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
              </svg>
              <div className="text-left">
                <div className="text-[10px] opacity-80">Download on the</div>
                <div className="text-sm font-medium -mt-0.5">App Store</div>
              </div>
            </a>
          )}

          {/* Direct APK */}
          {apkUrl && (
            <a
              href={apkUrl}
              download
              className="flex items-center gap-3 px-4 py-2.5 border border-border rounded-lg hover:bg-surface transition-colors"
            >
              <svg className="w-6 h-6 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <div className="text-left">
                <div className="text-sm font-medium">Download APK</div>
                <div className="text-[10px] text-muted">
                  {apkVersion && `v${apkVersion}`}
                  {apkVersion && apkSize && " · "}
                  {apkSize}
                </div>
              </div>
            </a>
          )}
        </div>

        {apkUrl && (
          <p className="text-xs text-muted">
            APK download is included with firmware purchase. Enable "Install from unknown sources" to install.
          </p>
        )}
      </div>
    </div>
  );
}
