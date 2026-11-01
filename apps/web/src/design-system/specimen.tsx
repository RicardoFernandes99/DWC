import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const colors = [
  { name: 'Background', className: 'bg-background text-foreground' },
  { name: 'Foreground', className: 'bg-foreground text-background' },
  { name: 'Card', className: 'bg-card text-card-foreground' },
  { name: 'Primary', className: 'bg-primary text-primary-foreground' },
  { name: 'Secondary', className: 'bg-secondary text-secondary-foreground' },
  { name: 'Muted', className: 'bg-muted text-muted-foreground' },
  { name: 'Accent', className: 'bg-accent text-accent-foreground' },
  {
    name: 'Destructive',
    className: 'bg-destructive text-destructive-foreground',
  },
  { name: 'Info', className: 'bg-info text-info-foreground' },
  { name: 'Success', className: 'bg-success text-success-foreground' },
  { name: 'Warning', className: 'bg-warning text-warning-foreground' },
  { name: 'Invert', className: 'bg-invert text-invert-foreground' },
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-border py-10 md:grid md:grid-cols-[12rem_minmax(0,1fr)] md:gap-8 xl:grid-cols-[16rem_minmax(0,1fr)]">
      <h2 className="mb-6 text-lg font-semibold md:mb-0">{title}</h2>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

export function Specimen() {
  return (
    <div className="min-h-svh bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-5 md:px-8">
          <span className="font-semibold tracking-tight">
            From Farm to Table
          </span>
          <span className="text-sm text-muted-foreground">
            Development / UI foundation
          </span>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 pb-16 md:px-8">
        <div className="py-12 md:py-16">
          <p className="text-sm font-medium uppercase tracking-widest text-primary">
            Design system
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight md:text-5xl">
            UI foundation
          </h1>
          <p className="mt-4 max-w-xl leading-relaxed text-muted-foreground">
            A working reference for the colors, type and controls used across
            the application.
          </p>
        </div>
        <Section title="Colors">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
            {colors.map((color) => (
              <div
                key={color.name}
                className={`flex min-h-24 items-end rounded-lg border p-3 text-sm font-medium ${color.className}`}
              >
                {color.name}
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            Borders, inputs and focus rings also use semantic theme tokens.
          </p>
        </Section>
        <Section title="Typography">
          <div className="space-y-5">
            <p className="text-4xl font-semibold tracking-tight">Heading one</p>
            <p className="text-2xl font-semibold tracking-tight">Heading two</p>
            <p className="text-lg font-semibold">Heading three</p>
            <p className="max-w-xl leading-relaxed">
              Body text is clear and comfortable to read. Use muted text for
              supporting details.
            </p>
            <p className="text-sm text-muted-foreground">
              Small supporting text
            </p>
          </div>
        </Section>
        <Section title="Spacing and radii">
          <div className="flex flex-wrap items-end gap-6">
            <div>
              <div className="h-4 w-4 bg-primary" />
              <p className="mt-2 text-sm">4 / 1rem</p>
            </div>
            <div>
              <div className="h-6 w-6 bg-primary" />
              <p className="mt-2 text-sm">6 / 1.5rem</p>
            </div>
            <div>
              <div className="h-8 w-8 bg-primary" />
              <p className="mt-2 text-sm">8 / 2rem</p>
            </div>
            <div>
              <div className="h-12 w-16 rounded-md border bg-card" />
              <p className="mt-2 text-sm">Medium</p>
            </div>
            <div>
              <div className="h-12 w-16 rounded-xl border bg-card" />
              <p className="mt-2 text-sm">Extra large</p>
            </div>
          </div>
        </Section>
        <Section title="Buttons">
          <div className="flex flex-wrap items-center gap-3">
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="link">Link</Button>
            <Button variant="destructive">Destructive</Button>
            <Button disabled>Disabled</Button>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            Use Tab to inspect the focus ring on interactive controls.
          </p>
        </Section>
        <Section title="Fields">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="example-email">Email address</Label>
              <Input
                id="example-email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
              />
              <p className="text-sm text-muted-foreground">
                We will use this to contact you.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="example-error">Password</Label>
              <Input
                id="example-error"
                type="password"
                aria-invalid="true"
                aria-describedby="password-error"
                defaultValue="short"
              />
              <p id="password-error" className="text-sm text-destructive">
                Enter at least 8 characters.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="example-disabled">Disabled field</Label>
              <Input
                id="example-disabled"
                disabled
                value="Unavailable"
                readOnly
              />
            </div>
          </div>
        </Section>
        <Section title="Cards and feedback">
          <div className="grid gap-4 xl:grid-cols-2">
            <Card className="p-6">
              <h3 className="font-semibold">A simple card</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Cards group related content on a distinct surface.
              </p>
              <Button className="mt-5" variant="outline">
                Example action
              </Button>
            </Card>
            <div className="space-y-3">
              <p className="rounded-lg border border-success/30 bg-success/10 p-4 text-sm text-foreground">
                <strong>Success.</strong> Your changes have been saved.
              </p>
              <p className="rounded-lg border border-warning/40 bg-warning/20 p-4 text-sm text-foreground">
                <strong>Warning.</strong> Review the details before continuing.
              </p>
              <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-foreground">
                <strong>Error.</strong> Something went wrong. Please try again.
              </p>
            </div>
          </div>
        </Section>
      </main>
    </div>
  );
}
