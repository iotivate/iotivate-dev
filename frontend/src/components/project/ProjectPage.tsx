"use client";

import PageHeader from "@/components/PageHeader";
import VideoEmbed from "./VideoEmbed";
import PartsList, { type Part } from "./PartsList";
import CircuitDiagram from "./CircuitDiagram";
import FileDownloads, { type DownloadFile } from "./FileDownloads";
import FirmwarePurchase from "./FirmwarePurchase";
import AppDownload from "./AppDownload";

export interface ProjectData {
  // Basic info (required)
  title: string;
  description: string;

  // Video (optional)
  youtubeId?: string;

  // Overview content (optional - markdown/HTML string)
  overview?: string;

  // Parts list (optional)
  parts?: Part[];

  // Circuit diagram (optional)
  circuit?: {
    src: string;
    alt?: string;
    downloadUrl?: string;
  };

  // Downloads - STL, PDF, etc (optional)
  downloads?: DownloadFile[];

  // Build guide steps (optional)
  buildGuide?: {
    title: string;
    content: string;
    warning?: string;
  }[];

  // Firmware (optional)
  firmware?: {
    name: string;
    version: string;
    price: number;
    currency?: string;
    features?: string[];
    firmwareUrl?: string;
  };

  // App (optional)
  app?: {
    name: string;
    description?: string;
    playStoreUrl?: string;
    apkUrl?: string;
    apkVersion?: string;
    apkSize?: string;
    iosUrl?: string;
    features?: string[];
  };

  // Support section (optional)
  support?: {
    text?: string;
    links?: { label: string; url: string }[];
  };
}

interface ProjectPageProps {
  data: ProjectData;
}

export default function ProjectPage({ data }: ProjectPageProps) {
  const hasPartsOrDownloads = data.parts || data.downloads;
  const hasFirmwareOrApp = data.firmware || data.app;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <PageHeader title={data.title} description={data.description} />

      <div className="space-y-8">
        {/* Video */}
        {data.youtubeId && (
          <section>
            <VideoEmbed youtubeId={data.youtubeId} title={data.title} />
          </section>
        )}

        {/* Overview */}
        {data.overview && (
          <section className="prose prose-invert max-w-none">
            <h2>Overview</h2>
            <div dangerouslySetInnerHTML={{ __html: data.overview }} />
          </section>
        )}

        {/* Parts and Downloads - side by side if both exist */}
        {hasPartsOrDownloads && (
          <div className={`grid grid-cols-1 ${data.parts && data.downloads ? "lg:grid-cols-2" : ""} gap-6`}>
            {data.parts && data.parts.length > 0 && <PartsList parts={data.parts} />}
            {data.downloads && data.downloads.length > 0 && (
              <FileDownloads title="Downloads" files={data.downloads} />
            )}
          </div>
        )}

        {/* Circuit Diagram */}
        {data.circuit && (
          <section>
            <CircuitDiagram
              src={data.circuit.src}
              alt={data.circuit.alt}
              downloadUrl={data.circuit.downloadUrl}
            />
          </section>
        )}

        {/* Build Guide */}
        {data.buildGuide && data.buildGuide.length > 0 && (
          <section className="prose prose-invert max-w-none">
            <h2>Build Guide</h2>
            {data.buildGuide.map((step, index) => (
              <div key={index}>
                <h3>{step.title}</h3>
                <div dangerouslySetInnerHTML={{ __html: step.content }} />
                {step.warning && (
                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 my-4 not-prose">
                    <strong className="text-yellow-400">Warning:</strong>{" "}
                    <span className="text-yellow-200/80">{step.warning}</span>
                  </div>
                )}
              </div>
            ))}
          </section>
        )}

        {/* Firmware and App - side by side if both exist */}
        {hasFirmwareOrApp && (
          <div className={`grid grid-cols-1 ${data.firmware && data.app ? "lg:grid-cols-2" : ""} gap-6`}>
            {data.firmware && (
              <FirmwarePurchase
                name={data.firmware.name}
                version={data.firmware.version}
                price={data.firmware.price}
                currency={data.firmware.currency}
                features={data.firmware.features}
                firmwareUrl={data.firmware.firmwareUrl}
              />
            )}
            {data.app && (
              <AppDownload
                name={data.app.name}
                description={data.app.description}
                playStoreUrl={data.app.playStoreUrl}
                apkUrl={data.app.apkUrl}
                apkVersion={data.app.apkVersion}
                apkSize={data.app.apkSize}
                iosUrl={data.app.iosUrl}
                features={data.app.features}
              />
            )}
          </div>
        )}

        {/* Support */}
        {data.support && (
          <section className="border border-border rounded-lg p-6 bg-surface/30">
            <h3 className="font-semibold mb-2">Need Help?</h3>
            {data.support.text && (
              <p className="text-sm text-muted mb-4">{data.support.text}</p>
            )}
            {data.support.links && data.support.links.length > 0 && (
              <div className="flex flex-wrap gap-3">
                {data.support.links.map((link, index) => (
                  <a
                    key={index}
                    href={link.url}
                    className="text-sm text-accent hover:underline"
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
