interface PageHeaderProps {
  title: string;
  description?: string;
}

export default function PageHeader({ title, description }: PageHeaderProps) {
  return (
    <div className="mb-12">
      <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">{title}</h1>
      {description && (
        <p className="mt-4 text-lg text-muted max-w-2xl">{description}</p>
      )}
    </div>
  );
}
