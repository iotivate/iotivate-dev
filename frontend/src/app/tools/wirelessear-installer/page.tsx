import type { Metadata } from "next";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import WirelessEarInstaller from "@/components/WirelessEarInstaller";

export const metadata: Metadata = {
  title: "WirelessEar Installer",
  description: "One-click firmware installer for the WirelessEar project.",
};

export default function WirelessEarInstallerPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <PageHeader
        title="WirelessEar Installer"
        description="One-click firmware installer for the WirelessEar wireless audio monitoring system."
      />
      <WirelessEarInstaller />
      <div className="mt-12 pt-8 border-t border-border">
        <p className="text-sm text-muted">
          Learn more about the WirelessEar project on the{" "}
          <Link href="/projects/wirelessear" className="text-accent hover:underline">
            project page
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
