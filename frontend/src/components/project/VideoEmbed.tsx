"use client";

interface VideoEmbedProps {
  youtubeId: string;
  title?: string;
}

export default function VideoEmbed({ youtubeId, title = "Project Video" }: VideoEmbedProps) {
  return (
    <div className="aspect-video rounded-lg overflow-hidden border border-border">
      <iframe
        src={`https://www.youtube.com/embed/${youtubeId}`}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="w-full h-full"
      />
    </div>
  );
}
