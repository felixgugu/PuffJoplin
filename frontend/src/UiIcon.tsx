export type UiIconName =
  | 'all-notes'
  | 'trash'
  | 'panel-close'
  | 'panel-open'
  | 'plus'
  | 'chevron-right'
  | 'chevron-down'
  | 'expand-all'
  | 'collapse-all'
  | 'folder'
  | 'summary'
  | 'locate'
  | 'pin'
  | 'close'
  | 'sun'
  | 'moon'
  | 'settings';

interface UiIconProps {
  name: UiIconName;
  filled?: boolean;
  className?: string;
}

export default function UiIcon({ name, filled = false, className = '' }: UiIconProps) {
  let content;
  switch (name) {
    case 'all-notes':
      content = (
        <>
          <rect x="4.25" y="2.75" width="11.5" height="14.5" rx="2" />
          <path d="M7 6.25h6M7 9.25h6M7 12.25h3.5" />
        </>
      );
      break;
    case 'trash':
      content = (
        <>
          <path d="M3.75 5.5h12.5M7.25 5.5V3.75h5.5V5.5" />
          <path d="m5.25 5.5.75 11h8l.75-11M8.25 8.25v5.5M11.75 8.25v5.5" />
        </>
      );
      break;
    case 'panel-close':
      content = (
        <>
          <rect x="2.75" y="3.75" width="14.5" height="12.5" rx="2" />
          <path d="M7.25 3.75v12.5M14.5 7.5 12 10l2.5 2.5" />
        </>
      );
      break;
    case 'panel-open':
      content = (
        <>
          <rect x="2.75" y="3.75" width="14.5" height="12.5" rx="2" />
          <path d="M7.25 3.75v12.5M12 7.5l2.5 2.5-2.5 2.5" />
        </>
      );
      break;
    case 'plus':
      content = <path d="M10 4v12M4 10h12" />;
      break;
    case 'chevron-right':
      content = <path d="m7.5 4.5 5.5 5.5-5.5 5.5" />;
      break;
    case 'chevron-down':
      content = <path d="m4.5 7.5 5.5 5.5 5.5-5.5" />;
      break;
    case 'expand-all':
      content = <path d="m4.75 4.75 5.25 4.5 5.25-4.5M4.75 10.75l5.25 4.5 5.25-4.5" />;
      break;
    case 'collapse-all':
      content = <path d="m4.75 15.25 5.25-4.5 5.25 4.5M4.75 9.25 10 4.75l5.25 4.5" />;
      break;
    case 'folder':
      content = <path d="M2.75 6.25h5l1.5 2h8v7.5a1.75 1.75 0 0 1-1.75 1.75H4.5a1.75 1.75 0 0 1-1.75-1.75V6.25Z" />;
      break;
    case 'summary':
      content = (
        <>
          <path d="M3.25 5.25h.5M7 5.25h9.75M3.25 10h.5M7 10h9.75M3.25 14.75h.5M7 14.75h6.5" />
        </>
      );
      break;
    case 'locate':
      content = (
        <>
          <circle cx="10" cy="10" r="5.25" />
          <path d="M10 2.5v3M10 14.5v3M2.5 10h3M14.5 10h3" />
          <circle cx="10" cy="10" r="1.5" />
        </>
      );
      break;
    case 'pin':
      content = (
        <path
          d="M7 2.5h6l-.7 4.5 3 3.25v1.75h-4.1v4.5L10 18l-1.2-1.5V12H4.7v-1.75l3-3.25L7 2.5Z"
          fill={filled ? 'currentColor' : 'none'}
        />
      );
      break;
    case 'close':
      content = <path d="m5 5 10 10M15 5 5 15" />;
      break;
    case 'sun':
      content = (
        <>
          <circle cx="10" cy="10" r="3.25" />
          <path d="M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M15.3 4.7l-1.4 1.4M6.1 13.9l-1.4 1.4" />
        </>
      );
      break;
    case 'moon':
      content = <path d="M15.75 12.5A6.5 6.5 0 0 1 7.5 4.25 6.75 6.75 0 1 0 15.75 12.5Z" />;
      break;
    case 'settings':
      content = (
        <>
          <path d="M3 5.25h3M9 5.25h8M3 10h8M14 10h3M3 14.75h1.5M7.5 14.75h9.5" />
          <circle cx="7.5" cy="5.25" r="1.5" />
          <circle cx="12.5" cy="10" r="1.5" />
          <circle cx="6" cy="14.75" r="1.5" />
        </>
      );
      break;
  }

  return (
    <svg
      className={`ui-icon ${className}`.trim()}
      viewBox="0 0 20 20"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {content}
    </svg>
  );
}
