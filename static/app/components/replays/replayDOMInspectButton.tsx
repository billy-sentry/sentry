import {useCallback, useEffect, useRef, useState} from 'react';

import {Button} from '@sentry/scraps/button';
import {Tooltip} from '@sentry/scraps/tooltip';

import {openModal} from 'sentry/actionCreators/modal';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {IconCursorArrow} from 'sentry/icons/iconCursorArrow';
import {t} from 'sentry/locale';
import {openSeerExplorer} from 'sentry/views/seerExplorer/openSeerExplorer';

import ReplayInspectQueryModal from './replayInspectQueryModal';

const HIGHLIGHT_STYLE =
  'outline: 2px solid #6C5FC7 !important; outline-offset: -1px !important; cursor: crosshair !important;';

/**
 * Button that enables DOM inspection mode in the replay iframe.
 * When active, users can click on elements in the replay to select them,
 * then provide a query to send to Seer Explorer along with the selected HTML.
 */
export default function ReplayDOMInspectButton() {
  const {getReplayIframe, togglePlayPause, isPlaying} = useReplayContext();
  const [isInspecting, setIsInspecting] = useState(false);
  const wasPlayingRef = useRef(false);
  const previousHighlightRef = useRef<HTMLElement | null>(null);
  const previousStyleRef = useRef<string>('');

  const cleanupHighlight = useCallback(() => {
    if (previousHighlightRef.current) {
      previousHighlightRef.current.style.cssText = previousStyleRef.current;
      previousHighlightRef.current = null;
      previousStyleRef.current = '';
    }
  }, []);

  const stopInspecting = useCallback(() => {
    setIsInspecting(false);
    cleanupHighlight();

    const iframe = getReplayIframe();
    if (iframe?.contentDocument) {
      iframe.contentDocument.body.style.cursor = '';
    }

    // Resume playback if it was playing before
    if (wasPlayingRef.current) {
      togglePlayPause(true);
      wasPlayingRef.current = false;
    }
  }, [getReplayIframe, cleanupHighlight, togglePlayPause]);

  const handleElementSelected = useCallback(
    (html: string) => {
      stopInspecting();
      openModal(
        deps => (
          <ReplayInspectQueryModal
            {...deps}
            selectedHtml={html}
            onSubmit={query => {
              deps.closeModal();
              const prompt = buildSeerPrompt(query, html);
              openSeerExplorer({
                startNewRun: true,
                initialMessage: prompt,
              });
            }}
          />
        ),
        {closeEvents: 'escape-key'}
      );
    },
    [stopInspecting]
  );

  // Set up event listeners on the replay iframe when inspecting
  useEffect(() => {
    if (!isInspecting) {
      return undefined;
    }

    const iframe = getReplayIframe();
    if (!iframe?.contentDocument) {
      setIsInspecting(false);
      return undefined;
    }

    const doc = iframe.contentDocument;
    doc.body.style.cursor = 'crosshair';

    function handleMouseOver(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target || target === doc?.body || target === doc?.documentElement) {
        return;
      }

      cleanupHighlight();

      previousHighlightRef.current = target;
      previousStyleRef.current = target.style.cssText;
      target.style.cssText += HIGHLIGHT_STYLE;
    }

    function handleMouseOut(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (target === previousHighlightRef.current) {
        cleanupHighlight();
      }
    }

    function handleClick(e: MouseEvent) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      const target = e.target as HTMLElement;
      if (!target || target === doc?.body || target === doc?.documentElement) {
        return;
      }

      // Extract the outerHTML of the selected element, truncated to a reasonable size
      const html = target.outerHTML.slice(0, 10000);
      handleElementSelected(html);
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        stopInspecting();
      }
    }

    doc.addEventListener('mouseover', handleMouseOver, true);
    doc.addEventListener('mouseout', handleMouseOut, true);
    doc.addEventListener('click', handleClick, true);
    doc.addEventListener('keydown', handleKeyDown, true);
    // Also listen on parent document for Escape
    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      doc.removeEventListener('mouseover', handleMouseOver, true);
      doc.removeEventListener('mouseout', handleMouseOut, true);
      doc.removeEventListener('click', handleClick, true);
      doc.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [
    isInspecting,
    getReplayIframe,
    cleanupHighlight,
    handleElementSelected,
    stopInspecting,
  ]);

  const handleToggleInspect = useCallback(() => {
    if (isInspecting) {
      stopInspecting();
      return;
    }

    const iframe = getReplayIframe();
    if (!iframe?.contentDocument) {
      return;
    }

    // Pause playback while inspecting
    if (isPlaying) {
      wasPlayingRef.current = true;
      togglePlayPause(false);
    }

    setIsInspecting(true);
  }, [isInspecting, isPlaying, getReplayIframe, stopInspecting, togglePlayPause]);

  return (
    <Tooltip
      title={
        isInspecting
          ? t('Click an element in the replay, or press Escape to cancel')
          : t('Inspect element and ask Seer')
      }
    >
      <Button
        size="xs"
        icon={<IconCursorArrow />}
        aria-label={t('Inspect DOM element')}
        onClick={handleToggleInspect}
        priority={isInspecting ? 'primary' : 'default'}
      />
    </Tooltip>
  );
}

function buildSeerPrompt(userQuery: string, html: string): string {
  // Truncate HTML if extremely long to keep prompt reasonable
  const truncatedHtml =
    html.length > 5000 ? html.slice(0, 5000) + '\n... (truncated)' : html;

  return `${userQuery}

The user selected the following DOM element from a Session Replay recording. Use this HTML context to focus your investigation:

\`\`\`html
${truncatedHtml}
\`\`\`

Please use this HTML as context to help investigate the user's query. The HTML represents a specific element the user identified in their session replay as relevant to their question.`;
}
