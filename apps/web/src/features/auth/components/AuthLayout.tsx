import type { ReactNode } from 'react';

import '../auth.css';

type AuthLayoutProps = {
  variant: 'login' | 'register';
  children: ReactNode;
};

const editorialContent = {
  login: {
    title: 'Good work.\nBetter together.',
    description:
      'Your own goals. A shared sense of purpose. Find your focus alongside other students.',
    principles: [
      {
        title: 'Settle into a room',
        description: 'A shared space. A fresh start.',
      },
      {
        title: 'Focus on your work',
        description: 'Less distraction. More intention.',
      },
      {
        title: 'Keep moving forward',
        description: 'One good study session at a time.',
      },
    ],
  },
  register: {
    title: 'Make room for\nyour best work.',
    description:
      'A place to show up, settle in, and make progress alongside other students.',
    principles: [
      {
        title: 'Find your people',
        description: 'A shared space for independent minds.',
      },
      {
        title: 'Build your rhythm',
        description: 'Small sessions. Steady progress.',
      },
      {
        title: 'Do your best work',
        description: 'More focus, with a little company.',
      },
    ],
  },
} as const;

export function AuthLayout({
  variant,
  children,
}: AuthLayoutProps) {
  const content = editorialContent[variant];

  return (
    <main className={`auth-page auth-page--${variant}`}>
      <aside className="auth-editorial">
        <div className="auth-brand">
          Study Rooms<span className="auth-brand-dot">.</span>
        </div>

        <div className="auth-editorial-story">
          <p className="auth-eyebrow">
            A LITTLE COMPANY. A LOT OF FOCUS.
          </p>

          <h2 className="auth-editorial-title">
            {content.title}
          </h2>

          <p className="auth-editorial-description">
            {content.description}
          </p>
        </div>

        <div className="auth-principles">
          {content.principles.map((principle, index) => (
            <div className="auth-principle" key={principle.title}>
              <span className="auth-principle-number">
                {String(index + 1).padStart(2, '0')}
              </span>

              <div className="auth-principle-copy">
                <h3>{principle.title}</h3>
                <p>{principle.description}</p>
              </div>

              <span className="auth-principle-arrow" aria-hidden="true">
                ↗
              </span>
            </div>
          ))}
        </div>

        <div className="auth-editorial-signature">
          <div>
            <p className="auth-signature-title">
              SEPARATE DESKS. SHARED MOMENTUM.
            </p>
            <p className="auth-signature-description">
              A space for what comes next.
            </p>
          </div>

          <span className="auth-focus-mark" aria-hidden="true" />
        </div>
      </aside>

      <section className="auth-main">
        <header className="auth-header">
          <div className="auth-brand auth-brand--mobile">
            Study Rooms<span className="auth-brand-dot">.</span>
          </div>

          <p className="auth-page-caption">
            YOUR SPACE TO FOCUS
          </p>
        </header>

        <div className="auth-form-alignment">
          {children}
        </div>

        <footer className="auth-panel-footer">
          <span>© 2026 Study Rooms</span>
          <span>A little company goes a long way.</span>
        </footer>
      </section>
    </main>
  );
}