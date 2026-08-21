export function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <div className="mb-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
      <div className="space-y-3">
        {eyebrow ? <p className="section-eyebrow">{eyebrow}</p> : null}
        <h1 className="font-headline text-4xl font-extrabold tracking-tight text-primary sm:text-5xl">
          {title}
        </h1>
        {description ? <p className="max-w-2xl text-sm leading-7 text-on-surface-variant">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
    </div>
  );
}
