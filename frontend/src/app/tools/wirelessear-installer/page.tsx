import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";

export const metadata: Metadata = {
  title: "WirelessEar Installer",
  description: "One-click firmware installer for the WirelessEar project.",
};

export default function WirelessEarInstallerPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <PageHeader
        title="WirelessEar Installer"
        description="One-click firmware installer for the WirelessEar project."
      />
      <div className="border border-border rounded-lg p-12 text-center">
        <div className="text-muted mb-4">
          <svg
            className="w-16 h-16 mx-auto mb-4 opacity-30"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            />
          </svg>
        </div>
        <h2 className="text-xl font-semibold mb-2">Coming Soon</h2>
        <p className="text-sm text-muted max-w-md mx-auto">
          Connect your WirelessEar board and flash the latest firmware with a
          single click. Powered by Web Serial.
        </p>
      </div>
    </div>
  );
}
