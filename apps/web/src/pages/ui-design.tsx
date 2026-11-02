import { Link } from '@tanstack/react-router';
import { ArrowLeft, ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

const references = [
  {
    file: 'orchard-reference.png',
    title: '01 — Orchard',
    description:
      'Selected desktop and mobile direction: warm cream, forest green, sage and orange. Use this board as the visual baseline for shadcn/ui and ReUI screens.',
  },
  {
    file: 'orchard-landscape.png',
    title: 'Landscape image',
    description: 'Source image for market and producer headers.',
  },
  {
    file: 'produce-sheet.png',
    title: 'Produce photography',
    description:
      'Source sheet with tomatoes, carrots, greens, honey, cheese and apples.',
  },
];

export function UIDesignPage() {
  return (
    <main className="mx-auto max-w-6xl space-y-8 px-5 py-10 md:px-8">
      <Button asChild variant="ghost">
        <Link to="/">
          <ArrowLeft /> Back to app
        </Link>
      </Button>
      <div>
        <h1 className="text-3xl font-semibold">UI Design</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Orchard reference images and visual baseline for the app. All images
          are generated design assets.
        </p>
      </div>
      {references.map((reference) => (
        <section
          key={reference.file}
          className="overflow-hidden rounded-xl border bg-card"
        >
          <div className="space-y-3 p-5">
            <h2 className="text-xl font-semibold">{reference.title}</h2>
            <p className="text-sm text-muted-foreground">
              {reference.description}
            </p>
            <a
              href={`/design/${reference.file}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 text-sm text-primary underline"
            >
              Open original image <ArrowUpRight className="size-4" />
            </a>
          </div>
          <img
            src={`/design/${reference.file}`}
            alt={reference.description}
            className="h-auto w-full"
            loading="lazy"
          />
        </section>
      ))}
    </main>
  );
}
