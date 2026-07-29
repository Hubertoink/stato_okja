import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { CheckCircle2, Lightbulb, X } from 'lucide-react';
import { useIsMobile } from '@/lib/useIsMobile';
import { demoModeEnabled } from './config';
import { setDemoMobileGuideMuted, useDemoMobileGuideMuted } from './mobileGuideState';
import { autoT } from '@/i18n/auto';

type DemoMobilePageGuide = {
  key: string;
  title: string;
  scenario: string;
  options: string[];
  tryThis: string;
};

const PAGE_GUIDES: Record<string, DemoMobilePageGuide> = {
  dashboard: {
    key: 'dashboard',
    title: autoT('ui_9bf6792d1807'),
    scenario: 'Stell dir vor, du startest den Dienst und willst schnell sehen, was heute ansteht und wo noch Dokumentation fehlt.',
    options: [
      autoT('ui_69a457bf2211'),
      autoT('ui_49e3634c3f80'),
      autoT('ui_bbd62af870cf'),
    ],
    tryThis: autoT('ui_8156e52d622b'),
  },
  activities: {
    key: 'activities',
    title: autoT('ui_76b99f607098'),
    scenario: autoT('ui_b1daebd83456'),
    options: [
      autoT('ui_4073366be9b1'),
      autoT('ui_fc7c4baf7c8a'),
      autoT('ui_1d56d5f12b19'),
    ],
    tryThis: autoT('ui_792a8e53a247'),
  },
  calendar: {
    key: 'calendar',
    title: autoT('ui_1d6f5a98c9cb'),
    scenario: autoT('ui_74008b2cd8ce'),
    options: [
      autoT('ui_de23e9505ceb'),
      autoT('ui_ad759b5f0a6a'),
      autoT('ui_8a66ada4cc23'),
    ],
    tryThis: 'Wechsle in die 3-Tage-Ansicht und tippe auf einen Plus-Button.',
  },
  projects: {
    key: 'projects',
    title: autoT('ui_9e97b72bf296'),
    scenario: autoT('ui_85efdf21a921'),
    options: [
      autoT('ui_278123a89cb9'),
      autoT('ui_fb63c495e775'),
      autoT('ui_95f7e253c897'),
    ],
    tryThis: autoT('ui_19a947b941c3'),
  },
  statistics: {
    key: 'statistics',
    title: autoT('ui_47c8be713210'),
    scenario: autoT('ui_41a301f5e1c9'),
    options: [
      autoT('ui_b266ee2d94fa'),
      autoT('ui_8cf215be34f1'),
      autoT('ui_2707b264c7c0'),
    ],
    tryThis: 'Setze einen Jahresfilter und schalte bei den Kennzahlen auf Durchschnittswerte.',
  },
  settings: {
    key: 'settings',
    title: autoT('ui_2a46ce33e667'),
    scenario: autoT('ui_a557b6939cf6'),
    options: [
      autoT('ui_0ccb5e76d724'),
      autoT('ui_ae4f326932e0'),
      autoT('ui_f730941728ed'),
    ],
    tryThis: 'Wechsle zwischen Kategorien und Einrichtungen und vergleiche, wie die Stammdaten aufgebaut sind.',
  },
};

function guideForPath(pathname: string) {
  const section = pathname.split('/').filter(Boolean)[0] || 'dashboard';
  return PAGE_GUIDES[section] ?? null;
}

export function hasDemoMobileGuideForPath(pathname: string) {
  return guideForPath(pathname) !== null;
}

export default function DemoMobilePageGuide() {
  const location = useLocation();
  const isMobile = useIsMobile(768);
  const guide = useMemo(() => guideForPath(location.pathname), [location.pathname]);
  const [open, setOpen] = useState(false);
  const [hideAfterConfirm, setHideAfterConfirm] = useState(false);
  const guidesMutedForPageLoad = useDemoMobileGuideMuted();
  const guideKey = guide?.key ?? '';

  useEffect(() => {
    if (!demoModeEnabled || !isMobile || !guide || guidesMutedForPageLoad) {
      setOpen(false);
      setHideAfterConfirm(false);
      return;
    }

    setOpen(false);
    setHideAfterConfirm(false);
    const timer = window.setTimeout(() => setOpen(true), 1000);
    return () => window.clearTimeout(timer);
  }, [guideKey, guide, guidesMutedForPageLoad, isMobile]);

  const closeGuide = () => {
    setHideAfterConfirm(false);
    setOpen(false);
  };

  const confirmGuide = () => {
    if (hideAfterConfirm) setDemoMobileGuideMuted(true);
    closeGuide();
  };

  if (!demoModeEnabled || !isMobile || !guide || !open || guidesMutedForPageLoad) return null;

  return (
    <div className="demo-mobile-page-guide-shell" aria-live="polite">
      <section
        className="demo-mobile-page-guide"
        role="dialog"
        aria-modal="false"
        aria-labelledby="demo-mobile-page-guide-title"
      >
        <button
          type="button"
          className="demo-mobile-page-guide-close"
          aria-label={autoT('ui_1dbfee7b12cc')}
          onClick={closeGuide}
        >
          <X aria-hidden="true" className="h-4 w-4" />
        </button>
        <div className="demo-mobile-page-guide-kicker">{autoT('ui_cf75bbfef7c2')}</div>
        <h3 id="demo-mobile-page-guide-title" className="demo-mobile-page-guide-title">
          {guide.title}
        </h3>
        <p className="demo-mobile-page-guide-scenario">{guide.scenario}</p>

        <div className="demo-mobile-page-guide-section-label">{autoT('ui_87e68ec495d7')}</div>
        <ul className="demo-mobile-page-guide-options">
          {guide.options.map((option) => (
            <li key={option}>
              <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
              <span>{option}</span>
            </li>
          ))}
        </ul>

        <div className="demo-mobile-page-guide-try">
          <Lightbulb aria-hidden="true" className="h-4 w-4" />
          <span>{guide.tryThis}</span>
        </div>
        <button
          type="button"
          className={`demo-mobile-page-guide-session-toggle${hideAfterConfirm ? "demo-mobile-page-guide-session-toggle-active" : ''}`}
          role="switch"
          aria-checked={hideAfterConfirm}
          onClick={() => setHideAfterConfirm((current) => !current)}
        >
          <span className="demo-mobile-page-guide-session-switch" aria-hidden="true">
            <span />
          </span>
          <span>{autoT('ui_2281d65808a2')}</span>
        </button>
        <button
          type="button"
          className="demo-mobile-page-guide-action"
          onClick={confirmGuide}
        >{autoT('ui_5e8d360bae74')}</button>
      </section>
    </div>
  );
}