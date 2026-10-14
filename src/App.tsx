import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent, MutableRefObject, ReactNode, RefObject } from 'react';
import { analyzeRepository, fetchRepositoryPage, formatNumber, timeAgo } from './github';
import type { DetailKind, GitHubBranch, GitHubCommit, GitHubContributor, GitHubIssue, GitHubPull, GitHubRelease, GitHubTag, PageResult, RepositoryReport } from './github';

type Panel = 'analyze' | 'method' | 'about' | 'results' | 'install' | null;

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};
type ResultsTab = 'overview' | 'activity' | 'commits' | 'tags' | 'contributors' | 'pulls' | 'issues' | 'releases' | 'branches' | 'notes';
const RESULTS_TABS: Array<[ResultsTab, string]> = [
  ['overview', 'Overview'], ['activity', 'Activity'], ['commits', 'All commits'],
  ['contributors', 'Contributors'], ['pulls', 'Pull requests'], ['issues', 'Issues'],
  ['releases', 'Releases'], ['tags', 'Tags'], ['branches', 'Branches'], ['notes', 'Data notes'],
];
const DETAIL_TABS: ResultsTab[] = ['commits', 'contributors', 'pulls', 'issues', 'releases', 'tags', 'branches'];
function isDetailTab(tab: ResultsTab): tab is DetailKind { return DETAIL_TABS.includes(tab); }

const EXAMPLE_REPO = 'vercel/next.js';
const BLURB = 'A quieter way to read the work behind the code.\nRepoPulse — activity, contributors, and maintenance.';
const GREETING = 'Understand how a repository moves, where work gathers, and what its public signals actually say.';

function InstallGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false">
      <path d="M8 1.8v8.1m0 0 3.1-3.1M8 9.9 4.9 6.8M2.5 10.4v2.8c0 .7.6 1.3 1.3 1.3h8.4c.7 0 1.3-.6 1.3-1.3v-2.8" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CopyGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true" focusable="false">
      <rect x="3.4" y="3.4" width="7.1" height="7.1" stroke="currentColor" strokeWidth="1" />
      <rect x="1.5" y="1.5" width="7.1" height="7.1" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

function TabIcon({ tab }: { tab: ResultsTab }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false" {...common}>
      {tab === 'overview' && <>
        <rect x="1.75" y="1.75" width="5" height="5" rx="1" />
        <rect x="9.25" y="1.75" width="5" height="5" rx="1" />
        <rect x="1.75" y="9.25" width="5" height="5" rx="1" />
        <rect x="9.25" y="9.25" width="5" height="5" rx="1" />
      </>}
      {tab === 'activity' && <>
        <path d="M1.5 12.75h13" />
        <path d="m2.25 9.75 3-3 2.35 1.7 4.2-5 2.2 1.8" />
        <circle cx="5.25" cy="6.75" r=".7" fill="currentColor" stroke="none" />
      </>}
      {tab === 'contributors' && <>
        <circle cx="6" cy="5.15" r="2.45" />
        <path d="M1.7 13.75c.35-2.35 1.9-3.55 4.3-3.55s3.95 1.2 4.3 3.55" />
        <path d="M10.2 3.1a2.35 2.35 0 0 1 0 4.5M11.2 10.35c1.65.25 2.6 1.35 3 3.05" />
      </>}
      {tab === 'commits' && <><path d="M3 3h10M3 8h7M3 13h10"/><circle cx="12" cy="8" r="2" fill="currentColor" stroke="none"/></>}
      {tab === 'pulls' && <><path d="M4 2.5v11M12 2.5v11M4 5.2h4.2a3.8 3.8 0 0 1 3.8 3.8"/><circle cx="4" cy="2.5" r="1.2"/><circle cx="12" cy="2.5" r="1.2"/><circle cx="12" cy="13.5" r="1.2"/></>}
      {tab === 'issues' && <><circle cx="8" cy="8" r="6"/><path d="M8 4.5v4M8 11.1h.01"/></>}
      {tab === 'releases' && <><path d="m2 7 5.8-5 6.1 6.1-5 5.8H5.8L2 10.1z"/><circle cx="6.1" cy="5.7" r="1.05"/></>}
      {tab === 'tags' && <><path d="m2 7 5.8-5 6.1 6.1-5 5.8H5.8L2 10.1z"/><circle cx="6.1" cy="5.7" r="1.05"/></>}
      {tab === 'branches' && <><path d="M4 2.5v11M4 5h5a3 3 0 0 1 3 3v.5"/><circle cx="4" cy="2.5" r="1.2"/><circle cx="4" cy="13.5" r="1.2"/><circle cx="12" cy="10.5" r="1.2"/></>}
      {tab === 'notes' && <>
        <path d="M4 1.75h5.15l3.1 3.1v9.4H4z" />
        <path d="M9 1.9v3.2h3.1M6.1 8h4.2M6.1 10.5h4.2" />
      </>}
    </svg>
  );
}

function ArrowIcon({ direction = 'right' }: { direction?: 'right' | 'up-right' }) {
  return direction === 'up-right' ? (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M4 12 12 4M5 4h7v7" stroke="currentColor" strokeWidth="1.35" strokeLinecap="square" />
    </svg>
  ) : (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2.5 8h10M8.5 3.5 13 8l-4.5 4.5" stroke="currentColor" strokeWidth="1.35" strokeLinecap="square" strokeLinejoin="miter" />
    </svg>
  );
}

function SceneStudy() {
  const sceneRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || reducedMotion) return undefined;

    let progress = 0.52;
    let prevX = 0;
    let prevY = 0;
    let ignoreNext = true;
    let nonMouseActive = false;
    scene.style.setProperty('--light-x', `${progress * 100}%`);

    const move = (clientX: number, clientY: number) => {
      if (ignoreNext) {
        prevX = clientX;
        prevY = clientY;
        ignoreNext = false;
        return;
      }
      const deltaX = clientX - prevX;
      const deltaY = clientY - prevY;
      prevX = clientX;
      prevY = clientY;
      if (Math.abs(deltaX) < Math.abs(deltaY) * 1.15) return;
      progress = Math.max(0.06, Math.min(0.94, progress + (deltaX / Math.max(1, window.innerWidth)) * 0.8));
      scene.style.setProperty('--light-x', `${progress * 100}%`);
    };
    const onMouseMove = (event: MouseEvent) => {
      if (!nonMouseActive) move(event.clientX, event.clientY);
    };
    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === 'mouse' || !event.isPrimary) return;
      nonMouseActive = true;
      prevX = event.clientX;
      prevY = event.clientY;
      ignoreNext = false;
    };
    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' && nonMouseActive) move(event.clientX, event.clientY);
    };
    const endPointer = () => {
      nonMouseActive = false;
      ignoreNext = true;
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') ignoreNext = true;
    };

    window.addEventListener('mousemove', onMouseMove, { passive: true });
    window.addEventListener('pointerdown', onPointerDown, { passive: true });
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerup', endPointer, { passive: true });
    window.addEventListener('pointercancel', endPointer, { passive: true });
    window.addEventListener('touchcancel', endPointer, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', endPointer);
      window.removeEventListener('pointercancel', endPointer);
      window.removeEventListener('touchcancel', endPointer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [reducedMotion]);

  return (
    <div ref={sceneRef} className="scene-study" aria-hidden="true">
      <div className="scene-grain" />
      <div className="scene-light-pass" />
      <svg className="scene-architecture" viewBox="0 0 1000 820" preserveAspectRatio="xMidYMid meet" fill="none">
        <defs>
          <linearGradient id="plinthTop" x1="280" y1="140" x2="840" y2="680" gradientUnits="userSpaceOnUse">
            <stop stopColor="#626762" />
            <stop offset="0.54" stopColor="#252725" />
            <stop offset="1" stopColor="#111210" />
          </linearGradient>
          <linearGradient id="plinthFront" x1="380" y1="400" x2="740" y2="750" gradientUnits="userSpaceOnUse">
            <stop stopColor="#343734" />
            <stop offset="1" stopColor="#10110F" />
          </linearGradient>
          <linearGradient id="resinA" x1="375" y1="90" x2="590" y2="430" gradientUnits="userSpaceOnUse">
            <stop stopColor="#F4F6F0" stopOpacity="0.62" />
            <stop offset="0.42" stopColor="#BCC4C0" stopOpacity="0.34" />
            <stop offset="1" stopColor="#6F7975" stopOpacity="0.12" />
          </linearGradient>
          <linearGradient id="resinB" x1="570" y1="52" x2="780" y2="454" gradientUnits="userSpaceOnUse">
            <stop stopColor="#F4F6F0" stopOpacity="0.62" />
            <stop offset="0.6" stopColor="#AEB5B1" stopOpacity="0.2" />
            <stop offset="1" stopColor="#D9DDD8" stopOpacity="0.05" />
          </linearGradient>
          <linearGradient id="resinC" x1="470" y1="210" x2="690" y2="500" gradientUnits="userSpaceOnUse">
            <stop stopColor="#E8EEEB" stopOpacity="0.5" />
            <stop offset="1" stopColor="#AEB5B1" stopOpacity="0.12" />
          </linearGradient>
          <filter id="sceneShadow" x="70" y="90" width="940" height="780" filterUnits="userSpaceOnUse">
            <feGaussianBlur stdDeviation="21" />
          </filter>
        </defs>
        <ellipse cx="633" cy="718" rx="330" ry="64" fill="#151613" fillOpacity="0.32" filter="url(#sceneShadow)" />
        <path d="M222 503 644 365 902 493 477 641 222 503Z" fill="#B0B6B1" fillOpacity="0.24" />
        <path d="M315 413 705 280 842 349 450 487 315 413Z" fill="url(#plinthTop)" stroke="#828A85" strokeOpacity="0.7" strokeWidth="1.3" />
        <path d="M450 487 842 349V628L450 760V487Z" fill="url(#plinthFront)" stroke="#747A75" strokeOpacity="0.44" strokeWidth="1.1" />
        <path d="M315 413 450 487V760L315 685V413Z" fill="#212320" stroke="#818780" strokeOpacity="0.28" strokeWidth="1.1" />
        <path d="M379 407 421 393 712 294 674 307 379 407Z" fill="#D9DDD8" fillOpacity="0.25" />
        <path d="M377 416 444 175 522 129 464 402 377 416Z" fill="url(#resinA)" stroke="#EEF0E8" strokeOpacity="0.78" strokeWidth="1.2" />
        <path d="M444 175 522 129 582 400 464 402 444 175Z" fill="#D9DDD8" fillOpacity="0.08" stroke="#DFE5E0" strokeOpacity="0.46" strokeWidth="1" />
        <path d="M518 133 621 77 721 354 582 400 518 133Z" fill="url(#resinB)" stroke="#EEF0E8" strokeOpacity="0.86" strokeWidth="1.4" />
        <path d="M621 77 688 110 792 327 721 354 621 77Z" fill="#D9DDD8" fillOpacity="0.14" stroke="#EEF0E8" strokeOpacity="0.42" strokeWidth="1" />
        <path d="M463 211 510 184 565 396" stroke="#FFFFFF" strokeOpacity="0.55" strokeWidth="1.6" />
        <path d="M625 113 682 256 719 350" stroke="#FFFFFF" strokeOpacity="0.54" strokeWidth="1.5" />
        <path d="M482 249 565 224 607 371" stroke="#E9EDE8" strokeOpacity="0.28" strokeWidth="1.1" />
        <path d="M574 413 685 376 752 404 639 444 574 413Z" fill="url(#resinC)" stroke="#E8ECE6" strokeOpacity="0.58" strokeWidth="1.2" />
        <path d="M639 444V486" stroke="#C7CDCA" strokeOpacity="0.55" strokeWidth="1.1" />
        <path d="M752 404V447" stroke="#C7CDCA" strokeOpacity="0.55" strokeWidth="1.1" />
        <path d="M574 413V454" stroke="#C7CDCA" strokeOpacity="0.4" strokeWidth="1.1" />
        <g stroke="#C7CCC5" strokeWidth="2" fill="#161714">
          <circle cx="451" cy="510" r="5" />
          <circle cx="451" cy="572" r="5" />
          <circle cx="451" cy="635" r="5" />
          <circle cx="806" cy="364" r="5" />
          <circle cx="806" cy="425" r="5" />
        </g>
        <path d="M801 534 842 520 842 547 801 561Z" fill="#B85E3E" />
        <path d="M801 534 810 531V557L801 561Z" fill="#E39A77" fillOpacity="0.8" />
        <path d="M292 710 434 760" stroke="#9EA59F" strokeOpacity="0.4" strokeWidth="1" />
        <path d="M445 760 840 628" stroke="#9EA59F" strokeOpacity="0.4" strokeWidth="1" />
      </svg>
      <div className="scene-topline">REPOSITORY STUDY / 001</div>
      <div className="scene-bottomline"><span>ACTIVITY / SIGNAL / CONTEXT</span><span>01—06</span></div>
      <div className="scene-crosshair"><span /><span /></div>
    </div>
  );
}

function useTypewriter(text: string, speed = 38, startDelay = 600) {
  const reduceMotion = useReducedMotion();
  const [displayed, setDisplayed] = useState(reduceMotion ? text : '');
  const [done, setDone] = useState(reduceMotion);

  useEffect(() => {
    if (reduceMotion) {
      setDisplayed(text);
      setDone(true);
      return undefined;
    }
    setDisplayed('');
    setDone(false);
    let count = 0;
    let interval = 0;
    const delay = window.setTimeout(() => {
      interval = window.setInterval(() => {
        count += 1;
        setDisplayed(text.slice(0, count));
        if (count >= text.length) {
          window.clearInterval(interval);
          setDone(true);
        }
      }, speed);
    }, startDelay);
    return () => { window.clearTimeout(delay); if (interval) window.clearInterval(interval); };
  }, [text, speed, startDelay, reduceMotion]);

  return { displayed, done };
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener?.('change', update);
    return () => query.removeEventListener?.('change', update);
  }, []);
  return reduced;
}

function SceneStatus({ message }: { message: string }) {
  return <div className="scene-status" aria-live="polite">{message}</div>;
}

function NavBar({
  menuOpen,
  onToggleMenu,
  onOpen,
  hamburgerRef,
}: {
  menuOpen: boolean;
  onToggleMenu: () => void;
  onOpen: (panel: Exclude<Panel, null>) => void;
  hamburgerRef: RefObject<HTMLButtonElement>;
}) {
  const items: { label: string; panel: Exclude<Panel, null> }[] = [
    { label: 'Repository', panel: 'analyze' },
    { label: 'Method', panel: 'method' },
    { label: 'About', panel: 'about' },
  ];

  const choose = (panel: Exclude<Panel, null>) => {
    onOpen(panel);
    if (menuOpen) window.setTimeout(() => hamburgerRef.current?.focus(), 0);
  };

  return (
    <header className="navbar">
      <div className="brand-lockup" role="img" aria-label="RepoPulse">
        <img className="brand-mark" src="/repopulse-mark.svg" alt="" width="30" height="30" draggable="false" />
        <span className="wordmark">RepoPulse</span>
      </div>
      <nav className="desktop-nav" aria-label="Main navigation">
        {items.map((item, index) => (
          <span className="nav-unit" key={item.label}>
            {index > 0 && <span className="nav-comma">, </span>}
            <button className="nav-button" type="button" onClick={() => choose(item.panel)}>{item.label}</button>
          </span>
        ))}
      </nav>
      <div className="nav-actions">
        <button className="nav-install" type="button" onClick={() => choose('install')}><InstallGlyph /> Install app</button>
        <button className="nav-cta" type="button" onClick={() => choose('analyze')}>Open repository study <ArrowIcon direction="up-right" /></button>
      </div>
      <button
        ref={hamburgerRef}
        className={`hamburger ${menuOpen ? 'is-open' : ''}`}
        type="button"
        aria-label={menuOpen ? 'Close menu' : 'Open menu'}
        aria-expanded={menuOpen}
        aria-controls="mobile-menu"
        onClick={onToggleMenu}
      >
        <span className="hamburger-bar hamburger-top" />
        <span className="hamburger-bar hamburger-mid" />
        <span className="hamburger-bar hamburger-bottom" />
      </button>
    </header>
  );
}

function MobileMenu({ open, onChoose }: { open: boolean; onChoose: (panel: Exclude<Panel, null>) => void }) {
  return (
    <div id="mobile-menu" className={`mobile-menu-overlay ${open ? 'menu-visible' : ''}`} aria-hidden={!open}>
      <nav className="mobile-menu-nav" aria-label="Mobile navigation">
        <button type="button" tabIndex={open ? 0 : -1} onClick={() => onChoose('analyze')}>Repository</button>
        <button type="button" tabIndex={open ? 0 : -1} onClick={() => onChoose('method')}>Method</button>
        <button type="button" tabIndex={open ? 0 : -1} onClick={() => onChoose('about')}>About RepoPulse</button>
        <button type="button" className="mobile-menu-install" tabIndex={open ? 0 : -1} onClick={() => onChoose('install')}><InstallGlyph /> Install RepoPulse</button>
        <button type="button" className="mobile-menu-note" tabIndex={open ? 0 : -1} onClick={() => onChoose('analyze')}>Open the repository study <ArrowIcon direction="up-right" /></button>
        <p>Developed by M Talha Iftikhar</p>
      </nav>
    </div>
  );
}

function Pill({ children, onClick, outline = false, disabled = false }: { children: ReactNode; onClick: () => void; outline?: boolean; disabled?: boolean }) {
  return <button type="button" className={`pill ${outline ? 'pill-outline' : 'pill-solid'}`} onClick={onClick} disabled={disabled}>{children}</button>;
}

function DialogShell({
  panel,
  onClose,
  headingRef,
  children,
  triggerRef,
}: {
  panel: Exclude<Panel, null>;
  onClose: () => void;
  headingRef: RefObject<HTMLHeadingElement>;
  children: ReactNode;
  triggerRef: MutableRefObject<HTMLElement | null>;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusTimer = window.setTimeout(() => headingRef.current?.focus(), 20);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
      )).filter((element) => element.getAttribute('aria-hidden') !== 'true');
      if (!focusable.length) {
        event.preventDefault();
        headingRef.current?.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || active === headingRef.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || active === headingRef.current)) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      triggerRef.current?.focus();
    };
  }, [headingRef, onClose, panel, triggerRef]);

  return (
    <div className={`dialog-overlay ${panel === 'results' ? 'results-overlay' : ''}`} role="presentation" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div ref={dialogRef} className={`dialog-panel ${panel === 'results' ? 'dialog-results' : ''}`} role="dialog" aria-modal="true" aria-labelledby="dialog-heading">
        {children}
      </div>
    </div>
  );
}

function DialogHeader({ title, headingRef, onClose, eyebrow }: { title: string; headingRef: RefObject<HTMLHeadingElement>; onClose: () => void; eyebrow?: string }) {
  return (
    <div className="dialog-header">
      <div>
        {eyebrow && <p className="dialog-eyebrow">{eyebrow}</p>}
        <h2 id="dialog-heading" ref={headingRef} tabIndex={-1}>{title}</h2>
      </div>
      <button className="dialog-close" type="button" aria-label="Close dialog" onClick={onClose}>×</button>
    </div>
  );
}

function AnalysisDialog({
  input,
  setInput,
  onSubmit,
  loading,
  error,
  onExample,
  headingRef,
  onClose,
  inputRef,
}: {
  input: string;
  setInput: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  loading: boolean;
  error: string;
  onExample: () => void;
  headingRef: RefObject<HTMLHeadingElement>;
  onClose: () => void;
  inputRef: RefObject<HTMLInputElement>;
}) {
  return (
    <>
      <DialogHeader title="Open a repository." headingRef={headingRef} onClose={onClose} eyebrow="REPO PULSE / INPUT" />
      <p className="dialog-copy">Enter a public GitHub repository. RepoPulse reads its available public metadata in your browser and turns it into a compact engineering study.</p>
      <form className="repo-form" onSubmit={onSubmit}>
        <label htmlFor="repository-url">Repository URL or owner/repository</label>
        <input
          id="repository-url"
          ref={inputRef}
          type="text"
          autoComplete="url"
          spellCheck={false}
          placeholder="https://github.com/vercel/next.js"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          aria-describedby={error ? 'repo-error' : 'repo-help'}
        />
        {!error && <p id="repo-help" className="field-hint">Public repositories only. No account sign-in or token required.</p>}
        {error && <p id="repo-error" className="field-error" aria-live="polite">{error}</p>}
        <button className="primary-action" type="submit" disabled={loading}>{loading ? <><span className="small-spinner" />Reading repository…</> : <>Analyze repository <ArrowIcon /></>}</button>
      </form>
      <div className="dialog-divider" />
      <div className="example-row">
        <div><span className="small-label">QUICK START</span><p>Use a public example to see the study layout.</p></div>
        <button className="text-link" type="button" onClick={onExample} disabled={loading}>Try {EXAMPLE_REPO} <ArrowIcon direction="up-right" /></button>
      </div>
      <p className="privacy-note">Public API requests are rate-limited by GitHub. Large repositories may return sampled activity rather than full history.</p>
    </>
  );
}

function MethodDialog({ headingRef, onClose }: { headingRef: RefObject<HTMLHeadingElement>; onClose: () => void }) {
  const steps = [
    ['01', 'Collect', 'Read the repository metadata, a recent commit sample, language bytes, contributors, and open work items.'],
    ['02', 'Interpret', 'Normalize dates, group commits by month, compare contribution counts, and make limits visible.'],
    ['03', 'Contextualize', 'Turn signals into questions for an engineer—not a simplistic score or an unverified verdict.'],
  ];
  return (
    <>
      <DialogHeader title="Method: collect, interpret, contextualize." headingRef={headingRef} onClose={onClose} eyebrow="A SMALL ANALYTICS SYSTEM" />
      <p className="dialog-copy">RepoPulse is designed as a transparent first read of a public repository. It does not pretend a single metric can prove code quality.</p>
      <div className="method-steps">
        {steps.map(([number, title, copy]) => (
          <div className="method-step" key={number}>
            <span className="step-number">{number}</span>
            <div><h3>{title}</h3><p>{copy}</p></div>
          </div>
        ))}
      </div>
      <div className="method-footnote"><span className="oxide-dot" /> Every finding is tied to public data, a sample window, or an explicit limitation.</div>
      <button className="primary-action close-action" type="button" onClick={onClose}>Understood <ArrowIcon /></button>
    </>
  );
}

function AboutDialog({ headingRef, onClose }: { headingRef: RefObject<HTMLHeadingElement>; onClose: () => void }) {
  return (
    <>
      <DialogHeader title="Built for a closer read." headingRef={headingRef} onClose={onClose} eyebrow="ABOUT REPOPULSE" />
      <p className="dialog-copy">RepoPulse is an independent portfolio project exploring how public software-development signals can become clearer, more useful, and more honest about their limits.</p>
      <div className="about-card">
        <div className="about-mark"><img src="/repopulse-mark.svg" width="32" height="32" alt="" /></div>
        <div><span className="small-label">DEVELOPED BY</span><h3>M Talha Iftikhar</h3><p>Software Engineering · Python · Data Analytics</p></div>
      </div>
      <div className="about-detail-list">
        <div><span>Data source</span><strong>GitHub public REST API</strong></div>
        <div><span>Architecture</span><strong>React · TypeScript · Vite</strong></div>
        <div><span>Install</span><strong>Progressive web app</strong></div>
        <div><span>Deployment</span><strong>Static frontend · Netlify-ready</strong></div>
      </div>
      <p className="privacy-note">RepoPulse is not affiliated with or endorsed by GitHub. Repository activity is a signal, not a definitive measure of quality, maintenance, or project health.</p>
      <button className="primary-action close-action" type="button" onClick={onClose}>Back to the room <ArrowIcon /></button>
    </>
  );
}

function InstallDialog({
  headingRef,
  onClose,
  canInstall,
  installed,
  message,
  onInstall,
}: {
  headingRef: RefObject<HTMLHeadingElement>;
  onClose: () => void;
  canInstall: boolean;
  installed: boolean;
  message: string;
  onInstall: () => void;
}) {
  return (
    <>
      <DialogHeader title={installed ? 'Already in your room.' : 'Keep RepoPulse close.'} headingRef={headingRef} onClose={onClose} eyebrow="INSTALL REPO PULSE" />
      <p className="dialog-copy">Install RepoPulse as an app for quicker access. The interface shell can be cached for offline opening; repository analysis still needs an internet connection to reach GitHub.</p>
      {installed ? (
        <div className="install-state" role="status"><span className="install-state-mark">✓</span><div><strong>RepoPulse is installed.</strong><p>Open it from your device's home screen or app launcher.</p></div></div>
      ) : canInstall ? (
        <button className="primary-action install-action" type="button" onClick={onInstall}><InstallGlyph /> Install RepoPulse</button>
      ) : (
        <div className="install-instructions">
          <div><span className="install-platform">DESKTOP / ANDROID</span><p>In Chrome or Edge, use the install icon in the address bar or choose <strong>Install app</strong> / <strong>Add to Home screen</strong> in the browser menu when offered.</p></div>
          <div><span className="install-platform">IPHONE / IPAD</span><p>Open this site in Safari, tap <strong>Share</strong>, then choose <strong>Add to Home Screen</strong>.</p></div>
        </div>
      )}
      {message && <p className="install-message" role="status" aria-live="polite">{message}</p>}
      <div className="install-capability"><span className="install-capability-dot" /><span>Installable shell · local assets · no account required</span></div>
      <button className="primary-action close-action" type="button" onClick={onClose}>Back to the room <ArrowIcon /></button>
    </>
  );
}

function MetricCard({ label, value, note, icon }: { label: string; value: string; note: string; icon: ReactNode }) {
  return (
    <div className="metric-card">
      <div className="metric-top"><span>{label}</span><span className="metric-icon">{icon}</span></div>
      <strong>{value}</strong>
      <p>{note}</p>
    </div>
  );
}

function TrendIcon() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M2 12 6 8l2.5 2.5L14 4.5M9.8 4.5H14V8.7" stroke="currentColor" strokeWidth="1.25" /></svg>;
}
function StarIcon() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m8 1.8 1.9 3.9 4.3.6-3.1 3-.7 4.3L8 11.6l-3.9 2 .7-4.3-3.1-3L6 5.7 8 1.8Z" stroke="currentColor" strokeWidth="1.15" strokeLinejoin="round" /></svg>;
}
function ForkIcon() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="4" cy="3" r="1.5" stroke="currentColor" strokeWidth="1.15"/><circle cx="12" cy="3" r="1.5" stroke="currentColor" strokeWidth="1.15"/><circle cx="4" cy="13" r="1.5" stroke="currentColor" strokeWidth="1.15"/><path d="M4 4.5V11.5M5.5 13H8a2 2 0 0 0 2-2V5" stroke="currentColor" strokeWidth="1.15" /></svg>;
}
function WorkIcon() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><rect x="2" y="3" width="12" height="10" rx="1" stroke="currentColor" strokeWidth="1.15"/><path d="M5 6h6M5 8.5h4" stroke="currentColor" strokeWidth="1.15" /></svg>;
}

function ActivityChart({ report }: { report: RepositoryReport }) {
  if (report.activityStatus !== 'ready') {
    const message = report.activityStatus === 'pending'
      ? 'GitHub is still calculating its weekly statistics. Re-run the analysis shortly to request them again.'
      : 'Weekly commit statistics are unavailable in this response. The rest of the repository report can still be explored.';
    return <div className="activity-unavailable"><span className="small-label">ACTIVITY DATA STATUS</span><p>{message}</p></div>;
  }
  if (!report.activity.length) return <p className="empty-state">GitHub returned no weekly commit-activity points for this repository.</p>;
  const max = Math.max(1, ...report.activity.map((item) => item.total));
  const plotWidth = 598;
  const step = plotWidth / report.activity.length;
  const bars = report.activity.map((item, index) => {
    const height = (item.total / max) * 100;
    return { ...item, x: 22 + index * step, y: 136 - height, height, index };
  });
  return (
    <div className="activity-chart-wrap">
      <div className="chart-legend"><span><i />Weekly commits</span><span>{formatNumber(report.activityTotal)} commits in returned 52-week window</span></div>
      <svg className="activity-chart" viewBox="0 0 644 184" role="img" aria-label={`Weekly commits over the last year: ${report.activity.map((item) => `${item.weekStart}: ${item.total}`).join(', ')}`}>
        {[31, 66, 101, 136].map((y) => <line key={y} x1="18" x2="625" y1={y} y2={y} stroke="#11110F" strokeOpacity="0.09" strokeDasharray="2 5" />)}
        {bars.map((bar, index) => (
          <g key={bar.weekStart}>
            <title>{`Week beginning ${bar.weekStart}: ${bar.total} commits`}</title>
            <rect x={bar.x} y={bar.y} width={Math.max(2.5, Math.min(8, step - 2))} height={Math.max(1.5, bar.height)} rx="1.5" fill="#11110F" fillOpacity="0.84" />
            <rect x={bar.x} y={bar.y} width={Math.max(1.5, Math.min(2.2, step - 3))} height={Math.max(1.5, bar.height)} rx="1" fill="#B85E3E" />
            {(index % 8 === 0 || index === bars.length - 1) && <text x={bar.x + Math.max(2.5, Math.min(8, step - 2)) / 2} y="160" textAnchor="middle" fontSize="9" fill="#11110F" fillOpacity="0.65">{bar.label.split(' ')[0]}</text>}
          </g>
        ))}
      </svg>
      <p className="chart-caption">This is GitHub’s weekly aggregate for approximately the last 52 weeks, not a lifetime total. Use All commits to browse individual commit records across the repository history.</p>
    </div>
  );
}

type DetailItem = GitHubCommit | GitHubContributor | GitHubPull | GitHubIssue | GitHubRelease | GitHubTag | GitHubBranch;

function RepositoryDetailsPanel({ fullName, kind, defaultBranch }: { fullName: string; kind: DetailKind; defaultBranch: string }) {
  const [page, setPage] = useState(1);
  const [refDraft, setRefDraft] = useState(defaultBranch);
  const [commitRef, setCommitRef] = useState(defaultBranch);
  const [result, setResult] = useState<PageResult<DetailItem> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retryToken, setRetryToken] = useState(0);
  const [loadedAt, setLoadedAt] = useState('');

  useEffect(() => {
    let current = true;
    setLoading(true);
    setError('');
    fetchRepositoryPage(kind, fullName, page, kind === 'commits' ? commitRef : undefined)
      .then((value) => {
        if (!current) return;
        setResult(value as PageResult<DetailItem>);
        setLoadedAt(new Date().toISOString());
      })
      .catch((caught: unknown) => {
        if (!current) return;
        setError(caught instanceof Error ? caught.message : 'GitHub data could not be loaded.');
        setResult(null);
      })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [fullName, kind, page, retryToken, commitRef]);

  const titles: Record<DetailKind, { eyebrow: string; heading: string; description: string }> = {
    commits: { eyebrow: 'COMMIT HISTORY', heading: 'Repository commits', description: 'Browse commits newest first. By default this shows the repository default branch; enter any branch, tag, or commit SHA in the ref field to inspect that history.' },
    contributors: { eyebrow: 'CONTRIBUTOR DIRECTORY', heading: 'Recognized contributors', description: 'Includes GitHub-recognized contributors and anonymous commit authors returned by the API.' },
    pulls: { eyebrow: 'PULL REQUEST ARCHIVE', heading: 'Pull requests', description: 'All states, ordered by most recently updated. Move through pages to browse older pull requests.' },
    issues: { eyebrow: 'ISSUE ARCHIVE', heading: 'Issues', description: 'Issues only; GitHub’s issues endpoint also contains pull requests, which are filtered out here.' },
    releases: { eyebrow: 'RELEASE HISTORY', heading: 'Published releases', description: 'GitHub releases only. Git tags that were never published as a release are not included in this list.' },
    tags: { eyebrow: 'GIT TAG DIRECTORY', heading: 'Repository tags', description: 'Git tags returned by GitHub, including tags that do not have a published release attached.' },
    branches: { eyebrow: 'BRANCH DIRECTORY', heading: 'Repository branches', description: 'Branches visible to the public repository API, including protection status and head commit SHA.' },
  };
  const title = titles[kind];
  const items = result?.items ?? [];
  const applyCommitRef = () => {
    const nextRef = refDraft.trim() || defaultBranch;
    if (nextRef === commitRef && page === 1) setRetryToken((value) => value + 1);
    else { setCommitRef(nextRef); setPage(1); }
  };

  const renderItems = () => {
    if (!result || !items.length) return <div className="detail-empty">{kind === 'releases' ? 'No published releases were returned. This does not mean the repository has no Git tags.' : kind === 'contributors' ? 'No contributor records were returned for this page.' : `No ${kind} records were returned on this page.`}</div>;
    if (kind === 'commits') return (items as GitHubCommit[]).map((item) => {
      const authored = item.commit.author?.date ?? item.commit.committer?.date;
      const authorName = item.author?.login ?? item.commit.author?.name ?? item.commit.committer?.name ?? 'Unknown author';
      const lines = (item.commit.message || '(no commit message)').split(/\r?\n/);
      return <article className="repository-detail-item commit-detail-item" key={item.sha}>
        <div className="detail-mark detail-mark-commit">↳</div>
        <div className="detail-primary"><a className="detail-title" href={item.html_url} target="_blank" rel="noopener noreferrer">{lines[0]}</a><p className="detail-summary">{lines.slice(1).join(' ').trim() || 'No extended commit description.'}</p><div className="detail-meta"><span>{authorName}</span><span>{authored ? new Date(authored).toLocaleString() : 'Date unavailable'}</span><code>{item.sha.slice(0, 7)}</code></div></div>
        <a className="detail-open" href={item.html_url} target="_blank" rel="noopener noreferrer" aria-label={`Open commit ${item.sha.slice(0, 7)} on GitHub`}><ArrowIcon direction="up-right" /></a>
      </article>;
    });
    if (kind === 'contributors') return (items as GitHubContributor[]).map((item, index) => {
      const name = item.login ?? item.name ?? 'Anonymous contributor';
      const identity = item.login ? <a className="detail-title" href={item.html_url || `https://github.com/${item.login}`} target="_blank" rel="noopener noreferrer">{name}</a> : <span className="detail-title">{name}</span>;
      return <article className="repository-detail-item" key={`${item.login ?? item.email ?? item.name ?? 'anonymous'}-${index}`}>
        <div className="detail-mark detail-mark-contributor">{String(index + 1 + (page - 1) * (result?.perPage ?? 100)).padStart(2, '0')}</div>
        <div className="detail-primary">{identity}<div className="detail-meta"><span>{item.login ? 'GitHub profile linked' : 'Anonymous commit author'}</span><span>{formatNumber(item.contributions)} recognized contributions</span></div></div>
        <strong className="detail-count">{formatNumber(item.contributions)}</strong>
      </article>;
    });
    if (kind === 'pulls') return (items as GitHubPull[]).map((item) => <article className="repository-detail-item" key={item.number}>
      <div className={`detail-mark ${item.state === 'open' ? 'detail-mark-open' : 'detail-mark-closed'}`}>{item.state === 'open' ? '↗' : '✓'}</div>
      <div className="detail-primary"><a className="detail-title" href={item.html_url} target="_blank" rel="noopener noreferrer">#{item.number} · {item.title}</a><div className="detail-meta"><span>{item.state}{item.draft ? ' · draft' : ''}{item.merged_at ? ' · merged' : ''}</span><span>By {item.user?.login ?? 'unknown'}</span><span>Updated {timeAgo(item.updated_at)}</span></div></div>
      <a className="detail-open" href={item.html_url} target="_blank" rel="noopener noreferrer" aria-label={`Open pull request ${item.number}`}><ArrowIcon direction="up-right" /></a>
    </article>);
    if (kind === 'issues') return (items as GitHubIssue[]).map((item) => <article className="repository-detail-item" key={item.number}>
      <div className={`detail-mark ${item.state === 'open' ? 'detail-mark-open' : 'detail-mark-closed'}`}>{item.state === 'open' ? '!' : '✓'}</div>
      <div className="detail-primary"><a className="detail-title" href={item.html_url} target="_blank" rel="noopener noreferrer">#{item.number} · {item.title}</a><div className="detail-meta"><span>{item.state}</span><span>By {item.user?.login ?? 'unknown'}</span><span>Updated {timeAgo(item.updated_at)}</span></div>{item.labels?.length ? <div className="detail-labels">{item.labels.map((label) => <span key={label.name} style={{ borderColor: `#${label.color}`, backgroundColor: `#${label.color}1b` }}>{label.name}</span>)}</div> : null}</div>
      <a className="detail-open" href={item.html_url} target="_blank" rel="noopener noreferrer" aria-label={`Open issue ${item.number}`}><ArrowIcon direction="up-right" /></a>
    </article>);
    if (kind === 'releases') return (items as GitHubRelease[]).map((item) => <article className="repository-detail-item" key={item.id}>
      <div className="detail-mark detail-mark-release">◇</div>
      <div className="detail-primary"><a className="detail-title" href={item.html_url} target="_blank" rel="noopener noreferrer">{item.name || item.tag_name}</a><div className="detail-meta"><code>{item.tag_name}</code><span>{item.published_at ? new Date(item.published_at).toLocaleDateString() : 'Unpublished date'}</span><span>{item.prerelease ? 'Pre-release' : 'Release'}{item.draft ? ' · draft' : ''}</span><span>{item.assets?.length ?? 0} assets</span></div></div>
      <a className="detail-open" href={item.html_url} target="_blank" rel="noopener noreferrer" aria-label={`Open release ${item.tag_name}`}><ArrowIcon direction="up-right" /></a>
    </article>);
    if (kind === 'tags') return (items as GitHubTag[]).map((item) => <article className="repository-detail-item" key={item.name}>
      <div className="detail-mark detail-mark-release">#</div>
      <div className="detail-primary"><span className="detail-title">{item.name}</span><div className="detail-meta"><code>{item.commit.sha.slice(0, 12)}</code><span>Git reference tag</span></div></div>
      <a className="detail-open" href={`https://github.com/${fullName}/tree/${item.name.split('/').map(encodeURIComponent).join('/')}`} target="_blank" rel="noopener noreferrer" aria-label={`Open tag ${item.name}`}><ArrowIcon direction="up-right" /></a>
    </article>);
    return (items as GitHubBranch[]).map((item) => <article className="repository-detail-item" key={item.name}>
      <div className="detail-mark detail-mark-branch">⑂</div>
      <div className="detail-primary"><span className="detail-title">{item.name}</span><div className="detail-meta"><code>{item.commit.sha.slice(0, 12)}</code><span>{item.protected ? 'Protected branch' : 'Not marked protected'}</span></div></div>
      <a className="detail-open" href={`https://github.com/${fullName}/tree/${item.name.split('/').map(encodeURIComponent).join('/')}`} target="_blank" rel="noopener noreferrer" aria-label={`Open branch ${item.name}`}><ArrowIcon direction="up-right" /></a>
    </article>);
  };

  return <div id={`panel-${kind}`} role="tabpanel" aria-labelledby={`tab-${kind}`} className="results-body tab-panel-enter repository-details-panel">
    <section className="report-card">
      <div className="report-card-heading"><div><span className="small-label">{title.eyebrow}</span><h3>{title.heading}</h3></div><span className="card-kicker">{result ? `${result.items.length} THIS PAGE` : loading ? 'LOADING' : 'NOT LOADED'}</span></div>
      <p className="detail-panel-intro">{title.description}</p>
      {kind === 'commits' && <div className="commit-ref-tools"><label htmlFor="commit-ref-input">Branch / tag / SHA</label><input id="commit-ref-input" value={refDraft} onChange={(event) => setRefDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); applyCommitRef(); } }} maxLength={160} placeholder={defaultBranch || 'Default branch'} /><button type="button" onClick={applyCommitRef} className="detail-retry">Load ref</button><span>Current ref: <code>{commitRef || defaultBranch || 'default branch'}</code></span></div>}
      {loading && <div className="detail-loading" role="status"><span className="detail-spinner" /> Fetching page {page} from GitHub…</div>}
      {!loading && error && <div className="detail-error" role="alert"><strong>Could not load this page.</strong><p>{error}</p><button type="button" className="detail-retry" onClick={() => setRetryToken((value) => value + 1)}>Retry request</button></div>}
      {!loading && !error && <div className="repository-detail-list">{renderItems()}</div>}
      {!error && <div className="detail-pagination"><div><span className="detail-page-label">PAGE {page}{result?.totalPages ? ` OF ${result.totalPages}` : ''}</span><span className="detail-page-note">{result ? `${result.rawCount} raw API records${kind === 'issues' ? ' · pull requests excluded' : ''}` : 'Waiting for API response'}{loadedAt ? ` · updated ${new Date(loadedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}</span></div><div className="detail-page-actions"><button type="button" className="detail-page-button" disabled={loading || page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>← Previous</button><button type="button" className="detail-page-button" disabled={loading || !result?.hasNext} onClick={() => setPage((value) => value + 1)}>Next page →</button></div></div>}
    </section>
    {kind === 'contributors' && <div className="insight-strip"><span className="insight-symbol">i</span><div><span className="small-label">ATTRIBUTION LIMITS</span><h3>Contributor counts are not impact scores.</h3><p>GitHub includes anonymous entries when available, but some author emails cannot be linked to a profile. Contribution totals may be cached by GitHub.</p></div></div>}
  </div>;
}

function RepoResults({
  report,
  activeTab,
  setActiveTab,
  onClose,
  onNewAnalysis,
  headingRef,
}: {
  report: RepositoryReport;
  activeTab: ResultsTab;
  setActiveTab: (tab: ResultsTab) => void;
  onClose: () => void;
  onNewAnalysis: () => void;
  headingRef: RefObject<HTMLHeadingElement>;
}) {
  const [copyStatus, setCopyStatus] = useState('');
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
  }, []);
  const repository = report.repository;
  const totalRecentCommits = report.activityTotal;
  const languageTotal = report.languageTotalBytes;

  const saveJson = () => {
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${repository.name}-repopulse-report.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    // Keep the object URL alive briefly so the browser can begin the download.
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const saveCsv = () => {
    const rows = [['week_start_utc', 'commits'], ...report.activity.map((item) => [item.weekStart, String(item.total)])];
    const csv = rows.map((row) => row.map((value) => `"${value.replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${repository.name}-weekly-commit-activity.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    // Keep the object URL alive briefly so the browser can begin the download.
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const copyLink = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(repository.html_url);
      if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
      setCopyStatus('Repository link copied');
      setCopied(true);
      copyTimerRef.current = window.setTimeout(() => { setCopyStatus(''); setCopied(false); copyTimerRef.current = null; }, 1800);
    } catch {
      setCopyStatus(repository.html_url);
      setCopied(false);
    }
  };

  const activeSignal = useMemo(() => {
    if (repository.archived) return { heading: 'Archived repository', copy: 'This repository is marked as archived. Recent activity may no longer be expected.' };
    if (!repository.pushed_at) return { heading: 'No recent push timestamp', copy: 'The repository metadata does not report a recent push.' };
    const days = Math.floor((Date.now() - new Date(repository.pushed_at).getTime()) / 86_400_000);
    if (days > 365) return { heading: 'Long time since last push', copy: `The last recorded push was ${timeAgo(repository.pushed_at)}. This is a prompt for further investigation, not proof of abandonment.` };
    if (days > 90) return { heading: 'Quiet recently', copy: `The last recorded push was ${timeAgo(repository.pushed_at)}. Consider the project's release cycle and issue activity before drawing conclusions.` };
    return { heading: 'Recent repository activity', copy: `A push was recorded ${timeAgo(repository.pushed_at)}. Commit count alone does not measure quality or impact.` };
  }, [repository.archived, repository.pushed_at]);

  return (
    <>
      <div className="results-topline"><span>REPOPULSE / REPOSITORY STUDY</span><span>GENERATED {new Date(report.fetchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></div>
      <div className="results-heading-row">
        <div className="results-repo-title">
          <p className="dialog-eyebrow">PUBLIC REPOSITORY</p>
          <h2 id="dialog-heading" ref={headingRef} tabIndex={-1}>{repository.full_name}</h2>
          <p>{repository.description || 'No repository description has been provided.'}</p>
          <div className="repo-chips">
            <span>{repository.language || 'Language not set'}</span>
            <span>Default branch: {repository.default_branch || 'unknown'}</span>
            {repository.archived && <span className="oxide-chip">Archived</span>}
          </div>
        </div>
        <div className="results-heading-actions">
          <a className="icon-text-action" href={repository.html_url} target="_blank" rel="noopener noreferrer">Open on GitHub <ArrowIcon direction="up-right" /></a>
          <button className="subtle-action" type="button" onClick={copyLink}><CopyGlyph /> {copied ? 'Copied' : 'Copy link'}</button>
          <button className="subtle-action" type="button" onClick={onNewAnalysis}>New study <span>↗</span></button>
        </div>
      </div>
      {copyStatus && <p className={`copy-status ${copied ? '' : 'copy-status-error'}`} aria-live="polite">{copyStatus}</p>}
      <div className="results-control-row">
        <div className="results-tabs" role="tablist" aria-label="Repository report sections">
          {RESULTS_TABS.map(([tab, label]) => (
            <button
              key={tab}
              id={`tab-${tab}`}
              type="button"
              role="tab"
              aria-selected={activeTab === tab}
              aria-controls={`panel-${tab}`}
              tabIndex={activeTab === tab ? 0 : -1}
              className={`results-tab results-tab-${tab}${activeTab === tab ? ' is-active' : ''}`}
              onClick={() => setActiveTab(tab)}
              onKeyDown={(event) => {
                if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
                event.preventDefault();
                const currentIndex = RESULTS_TABS.findIndex(([key]) => key === tab);
                const backwards = event.key === 'ArrowLeft' || event.key === 'ArrowUp';
                const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? RESULTS_TABS.length - 1 :
                  (currentIndex + (backwards ? -1 : 1) + RESULTS_TABS.length) % RESULTS_TABS.length;
                const nextTab = RESULTS_TABS[nextIndex][0];
                setActiveTab(nextTab);
                document.getElementById(`tab-${nextTab}`)?.focus();
              }}
            >
              <span className="results-tab-icon"><TabIcon tab={tab} /></span>
              <span className="results-tab-label">{label}</span>
              <span className="results-tab-spark" aria-hidden="true" />
            </button>
          ))}
        </div>
        <div className="results-export" aria-label="Download report data">
          <button className="export-csv" type="button" onClick={saveCsv}><span className="export-icon" aria-hidden="true">↓</span><span>Export CSV</span></button>
          <button className="export-json" type="button" onClick={saveJson}><span className="export-icon" aria-hidden="true">{ }</span><span>Export JSON</span></button>
        </div>
      </div>

      {activeTab === 'overview' && <div id="panel-overview" role="tabpanel" aria-labelledby="tab-overview" className="results-body tab-panel-enter">
        <div className="metric-grid">
          <MetricCard label="Stars" value={formatNumber(repository.stargazers_count)} note="Public interest signal" icon={<StarIcon />} />
          <MetricCard label="Forks" value={formatNumber(repository.forks_count)} note="Repository forks" icon={<ForkIcon />} />
          <MetricCard label="Open work items" value={formatNumber(repository.open_issues_count)} note="Issues and pull requests combined" icon={<WorkIcon />} />
          <MetricCard label="Commits · last year" value={report.activityStatus === 'ready' ? formatNumber(totalRecentCommits) : '—'} note={report.activityStatus === 'ready' ? 'GitHub weekly aggregate' : report.activityStatus === 'pending' ? 'Statistics pending' : 'Statistics unavailable'} icon={<TrendIcon />} />
        </div>
        <div className="dashboard-grid">
          <section className="report-card chart-card">
            <div className="report-card-heading"><div><span className="small-label">LAST YEAR / WEEKLY AGGREGATE</span><h3>Commit rhythm</h3></div><span className="card-kicker">{report.activity.length} WEEKS</span></div>
            <ActivityChart report={report} />
          </section>
          <section className="report-card language-card">
            <div className="report-card-heading"><div><span className="small-label">CODE COMPOSITION</span><h3>Language mix</h3></div><span className="card-kicker">BY BYTES</span></div>
            {report.languages.length ? <>
              <div className="language-stacked" aria-label={report.languages.map((item) => `${item.language}: ${item.percentage.toFixed(1)} percent`).join(', ')}>
                {report.languages.map((item, index) => <span key={item.language} className={`language-segment segment-${index % 6}`} style={{ width: `${item.percentage}%` }} title={`${item.language}: ${item.percentage.toFixed(1)}%`} />)}
              </div>
              <div className="language-rows">{report.languages.map((item, index) => <div className="language-row" key={item.language}><span className={`language-dot segment-${index % 6}`} /><span>{item.language}</span><strong>{item.percentage.toFixed(1)}%</strong></div>)}</div>
              <p className="chart-caption">Percentages are calculated from all language byte counts returned by GitHub ({formatNumber(languageTotal)} bytes). They are not source-line percentages.</p>
            </> : <p className="empty-state">{report.dataNotes.some((note) => note.startsWith('Language data could not')) ? 'Language data could not be fetched in this request.' : 'GitHub returned no language byte counts for this repository.'}</p>}
          </section>
        </div>
        <div className="insight-strip"><span className="insight-symbol">↗</span><div><span className="small-label">READ THIS SIGNAL CAREFULLY</span><h3>{activeSignal.heading}</h3><p>{activeSignal.copy}</p></div></div>
        <section className="report-card repo-facts-card"><div className="report-card-heading"><div><span className="small-label">REPOSITORY METADATA</span><h3>Project facts</h3></div></div><div className="repo-facts-grid">
          <div><span>Created</span><strong>{new Date(repository.created_at).toLocaleDateString()}</strong></div>
          <div><span>Last updated</span><strong>{new Date(repository.updated_at).toLocaleString()}</strong></div>
          <div><span>Last push</span><strong>{repository.pushed_at ? new Date(repository.pushed_at).toLocaleString() : 'Not reported'}</strong></div>
          <div><span>Watchers</span><strong>{formatNumber(repository.watchers_count)}</strong></div>
          <div><span>Repository size</span><strong>{repository.size == null ? 'Not reported' : `${formatNumber(repository.size)} KB`}</strong></div>
          <div><span>License</span><strong>{repository.license?.spdx_id || repository.license?.name || 'Not specified'}</strong></div>
          <div><span>Visibility</span><strong>{repository.visibility || 'Public API result'}</strong></div>
          <div><span>Repository type</span><strong>{repository.fork ? 'Fork' : 'Source repository'}{repository.archived ? ' · Archived' : ''}</strong></div>
        </div>{repository.topics?.length ? <div className="detail-labels repo-topics">{repository.topics.map((topic) => <span key={topic}>{topic}</span>)}</div> : null}{repository.homepage ? <p className="repo-homepage">Project homepage: <a href={repository.homepage} target="_blank" rel="noopener noreferrer">{repository.homepage}</a></p> : null}</section>
        <div className="overview-foot"><span>Created {new Date(repository.created_at).toLocaleDateString()}</span><span>Updated {timeAgo(repository.updated_at)}</span><span>{report.activityStatus === 'ready' ? `${formatNumber(totalRecentCommits)} weekly aggregate commits` : 'Activity statistics not confirmed'}</span></div>
      </div>}

      {activeTab === 'activity' && <div id="panel-activity" role="tabpanel" aria-labelledby="tab-activity" className="results-body tab-panel-enter">
        <div className="activity-detail-grid">
          <section className="report-card chart-card"><div className="report-card-heading"><div><span className="small-label">LAST YEAR / WEEKLY AGGREGATE</span><h3>Commit activity by week</h3></div><span className="card-kicker">{report.activity.length} POINTS</span></div><ActivityChart report={report} /></section>
          <section className="report-card"><span className="small-label">DATA INTERPRETATION</span><h3 className="section-card-title">What this chart includes</h3><ul className="signal-list"><li>Weekly commit totals returned by GitHub's repository statistics API for approximately the last 52 weeks.</li><li>Weeks with zero commits remain visible when GitHub includes them in the statistics response.</li><li>For individual commit records and earlier history, use the All commits tab and paginate through the API's commit list.</li></ul><p className="chart-caption">GitHub may take time to calculate repository statistics. If data is pending or unavailable, this view says so rather than substituting the current month or zeros.</p></section>
        </div>
        <div className="insight-strip"><span className="insight-symbol">i</span><div><span className="small-label">LIFETIME VS. RECENT ACTIVITY</span><h3>One chart should not pretend to be the full history.</h3><p>The activity chart covers the returned weekly statistics window. All commit records can be browsed separately in pages; no single 100-item sample is labelled as lifetime activity.</p></div></div>
      </div>}

      {isDetailTab(activeTab) && <RepositoryDetailsPanel key={`${repository.full_name}-${activeTab}`} fullName={repository.full_name} kind={activeTab} defaultBranch={repository.default_branch} />}

      {activeTab === 'notes' && <div id="panel-notes" role="tabpanel" aria-labelledby="tab-notes" className="results-body tab-panel-enter">
        <div className="report-card notes-card"><span className="small-label">TRANSPARENCY LOG</span><h3 className="section-card-title">How to read this report</h3><p className="dialog-copy">This view is built from public GitHub API responses. The data may be incomplete due to page caps, privacy settings, repository activity, or API rate limits.</p><div className="data-note-list">{report.dataNotes.map((note, index) => <div key={note}><span>{String(index + 1).padStart(2, '0')}</span><p>{note}</p></div>)}</div><div className="report-meta-grid"><div><span>Report requested</span><strong>{new Date(report.fetchedAt).toLocaleString()}</strong></div><div><span>Repository updated</span><strong>{new Date(repository.updated_at).toLocaleString()}</strong></div><div><span>Activity coverage</span><strong>{report.activity.length} weekly points · {report.activityStatus}</strong></div><div><span>API detail views</span><strong>Page-by-page, on demand</strong></div></div></div>
      </div>}
      <div className="results-bottom"><span>REPOPULSE / DEVELOPED BY M TALHA IFTIKHAR</span><button type="button" onClick={onClose}>Close study <span>×</span></button></div>
    </>
  );
}

function NotFound() {
  return (
    <main className="not-found">
      <img className="not-found-logo" src="/repopulse-mark.svg" width="32" height="32" alt="RepoPulse" />
      <p className="dialog-eyebrow">REPOPULSE / 404</p>
      <h1>This room is not in the current study.</h1>
      <p>The threshold you asked for is not staged. Return to the studio entrance.</p>
      <a className="pill pill-solid" href="/">Back to the room <ArrowIcon /></a>
    </main>
  );
}

export default function App() {
  const path = window.location.pathname;
  const reducedMotion = useReducedMotion();
  const [coarsePointer, setCoarsePointer] = useState(() => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches);
  const { displayed, done } = useTypewriter(GREETING);
  const [panel, setPanel] = useState<Panel>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(display-mode: standalone)').matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  });
  const [installNotice, setInstallNotice] = useState('');
  const [repositoryInput, setRepositoryInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [report, setReport] = useState<RepositoryReport | null>(null);
  const [activeTab, setActiveTab] = useState<ResultsTab>('overview');
  const [pillsVisible, setPillsVisible] = useState(false);
  const [copyLabel, setCopyLabel] = useState('Copy project note');
  const [copyError, setCopyError] = useState(false);
  const copyLabelTimerRef = useRef<number | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const hamburgerRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const requestId = useRef(0);
  const heroContentRef = useRef<HTMLElement>(null);

  useEffect(() => () => {
    if (copyLabelTimerRef.current !== null) window.clearTimeout(copyLabelTimerRef.current);
  }, []);

  useEffect(() => {
    if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return undefined;
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((registrationError: unknown) => {
      console.warn('RepoPulse offline support could not be enabled in this session.', registrationError);
    });
    return undefined;
  }, []);

  useEffect(() => {
    const displayMode = window.matchMedia('(display-mode: standalone)');
    const updateInstalledState = () => {
      const standalone = displayMode.matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
      setIsInstalled(standalone);
    };
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const onAppInstalled = () => {
      setIsInstalled(true);
      setInstallPrompt(null);
      setInstallNotice('RepoPulse was installed successfully.');
    };
    displayMode.addEventListener?.('change', updateInstalledState);
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);
    updateInstalledState();
    return () => {
      displayMode.removeEventListener?.('change', updateInstalledState);
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  useEffect(() => {
    const query = window.matchMedia('(pointer: coarse)');
    const updatePointer = () => setCoarsePointer(query.matches);
    updatePointer();
    query.addEventListener?.('change', updatePointer);
    return () => query.removeEventListener?.('change', updatePointer);
  }, []);

  useEffect(() => {
    if (reducedMotion) {
      setPillsVisible(true);
      return undefined;
    }
    const timer = window.setTimeout(() => setPillsVisible(true), 400);
    return () => window.clearTimeout(timer);
  }, [reducedMotion]);

  useEffect(() => {
    const content = heroContentRef.current;
    if (!content) return undefined;
    if (menuOpen) content.setAttribute('inert', '');
    else content.removeAttribute('inert');
    return () => content.removeAttribute('inert');
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        hamburgerRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [menuOpen]);

  const openPanel = (nextPanel: Exclude<Panel, null>) => {
    triggerRef.current = document.activeElement as HTMLElement;
    setError('');
    setMenuOpen(false);
    setPanel(nextPanel);
  };

  const closePanel = useCallback(() => {
    requestId.current += 1;
    setPanel(null);
    setError('');
    setLoading(false);
  }, []);

  const runAnalysis = async (input: string) => {
    const callId = ++requestId.current;
    setError('');
    setLoading(true);
    setPanel('analyze');
    try {
      const result = await analyzeRepository(input);
      if (callId !== requestId.current) return;
      setReport(result);
      setActiveTab('overview');
      setPanel('results');
    } catch (caught) {
      if (callId !== requestId.current) return;
      setError(caught instanceof Error ? caught.message : 'The repository could not be analyzed. Please try again.');
      setPanel('analyze');
    } finally {
      if (callId === requestId.current) setLoading(false);
    }
  };

  const handleAnalyzeSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void runAnalysis(repositoryInput);
  };

  const runExample = () => {
    if (!panel) triggerRef.current = document.activeElement as HTMLElement;
    setRepositoryInput(EXAMPLE_REPO);
    setError('');
    setPanel('analyze');
    void runAnalysis(EXAMPLE_REPO);
  };

  const chooseFromMenu = (nextPanel: Exclude<Panel, null>) => {
    triggerRef.current = hamburgerRef.current;
    setMenuOpen(false);
    setPanel(nextPanel);
  };

  const copyProjectNote = async () => {
    const note = 'RepoPulse turns public development signals into a clearer first read of how software projects move. Developed by M Talha Iftikhar.';
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(note);
      if (copyLabelTimerRef.current !== null) window.clearTimeout(copyLabelTimerRef.current);
      setCopyLabel('Copied');
      setCopyError(false);
      copyLabelTimerRef.current = window.setTimeout(() => { setCopyLabel('Copy project note'); copyLabelTimerRef.current = null; }, 1800);
    } catch {
      setCopyLabel('Copy unavailable — select About RepoPulse for project details.');
      setCopyError(true);
    }
  };

  const installApp = async () => {
    if (!installPrompt) {
      setInstallNotice('Your browser has not opened an automatic install prompt. Follow the browser-specific steps shown above.');
      return;
    }
    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      setInstallNotice(choice.outcome === 'accepted'
        ? 'Install request accepted. Follow any remaining browser confirmation.'
        : 'Install was dismissed. You can install RepoPulse later from your browser menu.');
    } catch {
      setInstallNotice('The install prompt could not be opened. Use the browser menu instructions above.');
    } finally {
      setInstallPrompt(null);
    }
  };

  if (path !== '/') return <NotFound />;

  return (
    <main className="hero-root">
      <SceneStudy />
      <div className="media-veil" aria-hidden="true" />
      <NavBar menuOpen={menuOpen} onToggleMenu={() => setMenuOpen((open) => !open)} onOpen={openPanel} hamburgerRef={hamburgerRef} />
      <MobileMenu open={menuOpen} onChoose={chooseFromMenu} />

      <section ref={heroContentRef} className={`hero-content ${menuOpen ? 'content-inert' : ''}`} aria-hidden={menuOpen}>
        <div className="hero-column">
          <p className="blurred-intro" aria-hidden="true">{BLURB}</p>
          <p className="typewriter-static sr-only">{GREETING}</p>
          <p className="typewriter-visual" aria-hidden="true">{displayed}{!done && !reducedMotion && <span className="type-cursor" />}</p>
          <p className={`drag-hint ${coarsePointer && !reducedMotion ? 'drag-hint-coarse' : ''}`}><span className="hint-dot" /> {coarsePointer && !reducedMotion ? 'Drag horizontally to explore' : 'A live read of public repository signals'}</p>
          <div className={`hero-actions ${pillsVisible ? 'pills-visible' : ''}`}>
            <Pill onClick={() => openPanel('analyze')}>Analyze a repository <ArrowIcon /></Pill>
            <Pill onClick={runExample}>Try {EXAMPLE_REPO} <ArrowIcon direction="up-right" /></Pill>
            <Pill onClick={() => openPanel('method')}>See the method</Pill>
            <Pill onClick={() => openPanel('about')}>About RepoPulse</Pill>
          </div>
          <div className="contact-row">
            <button className={`contact-copy ${copyError ? 'contact-copy-error' : ''}`} type="button" onClick={copyProjectNote}>
              <CopyGlyph /> <span>{copyLabel}</span>
            </button>
            <span className="built-credit">Developed by M Talha Iftikhar</span>
          </div>
          <span className="sr-only" aria-live="polite">{copyError ? copyLabel : copyLabel === 'Copied' ? 'Project note copied' : ''}</span>
        </div>
      </section>

      <SceneStatus message="Public GitHub data · no account required" />
      <div className="hero-index" aria-hidden="true"><span>ENGINEERING SIGNALS</span><span>STUDY / 001</span></div>

      {panel && <DialogShell panel={panel} onClose={closePanel} headingRef={headingRef} triggerRef={triggerRef}>
        {panel === 'analyze' && <AnalysisDialog input={repositoryInput} setInput={setRepositoryInput} onSubmit={handleAnalyzeSubmit} loading={loading} error={error} onExample={runExample} headingRef={headingRef} onClose={closePanel} inputRef={inputRef} />}
        {panel === 'method' && <MethodDialog headingRef={headingRef} onClose={closePanel} />}
        {panel === 'about' && <AboutDialog headingRef={headingRef} onClose={closePanel} />}
        {panel === 'install' && <InstallDialog headingRef={headingRef} onClose={closePanel} canInstall={Boolean(installPrompt)} installed={isInstalled} message={installNotice} onInstall={() => { void installApp(); }} />}
        {panel === 'results' && report && <RepoResults report={report} activeTab={activeTab} setActiveTab={setActiveTab} onClose={closePanel} onNewAnalysis={() => { setRepositoryInput(report.repository.full_name); setError(''); setPanel('analyze'); }} headingRef={headingRef} />}
        {panel === 'results' && !report && <div><DialogHeader title="No study loaded." headingRef={headingRef} onClose={closePanel} /><p className="dialog-copy">Run a repository analysis to populate this report.</p><button className="primary-action" onClick={() => setPanel('analyze')} type="button">Analyze repository <ArrowIcon /></button></div>}
      </DialogShell>}
    </main>
  );
}
