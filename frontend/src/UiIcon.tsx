export type UiIconName =
  | 'dashboard'
  | 'all-notes'
  | 'todo'
  | 'todo-checkbox'
  | 'todo-checkbox-checked'
  | 'trash'
  | 'panel-close'
  | 'panel-open'
  | 'plus'
  | 'search'
  | 'chevron-up'
  | 'chevron-right'
  | 'chevron-down'
  | 'expand-all'
  | 'collapse-all'
  | 'folder'
  | 'folder-managed'
  | 'summary'
  | 'locate'
  | 'pin'
  | 'copy'
  | 'calendar'
  | 'download'
  | 'eye'
  | 'eye-off'
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
    case 'dashboard':
      content = (
        <>
          <rect x="2.75" y="2.75" width="6" height="6" rx="1.4" />
          <rect x="11.25" y="2.75" width="6" height="4" rx="1.4" />
          <rect x="2.75" y="11.25" width="6" height="6" rx="1.4" />
          <rect x="11.25" y="9.25" width="6" height="8" rx="1.4" />
        </>
      );
      break;
    case 'all-notes':
      content = (
        <>
          <rect x="4.25" y="2.75" width="11.5" height="14.5" rx="2" />
          <path d="M7 6.25h6M7 9.25h6M7 12.25h3.5" />
        </>
      );
      break;
    case 'todo':
      content = (
        <>
          <rect x="3.25" y="3.25" width="13.5" height="13.5" rx="3" />
          <path d="m6.5 10 2.25 2.25 4.75-5" />
        </>
      );
      break;
    case 'todo-checkbox':
      content = <rect x="3.25" y="3.25" width="13.5" height="13.5" rx="3.25" />;
      break;
    case 'todo-checkbox-checked':
      content = (
        <>
          <rect x="3.25" y="3.25" width="13.5" height="13.5" rx="3.25" />
          <path d="m6.5 10 2.25 2.25 4.75-5" />
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
    case 'search':
      content = (
        <>
          <circle cx="8.5" cy="8.5" r="4.75" />
          <path d="m12 12 4.25 4.25" />
        </>
      );
      break;
    case 'chevron-up':
      content = <path d="m4.5 12.5 5.5-5.5 5.5 5.5" />;
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
    case 'folder-managed':
      content = (
        <>
          <path d="M2.75 6.25h5l1.5 2h8v7.5a1.75 1.75 0 0 1-1.75 1.75H4.5a1.75 1.75 0 0 1-1.75-1.75V6.25Z" />
          <path d="m12.25 11.25 1.5 1.25-1.5 1.25M10.75 14.5l2.25-4" />
        </>
      );
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
    case 'copy':
      content = (
        <>
          <rect x="7" y="7" width="9.5" height="10" rx="1.75" />
          <path d="M13 7V5.5a1.75 1.75 0 0 0-1.75-1.75h-7A1.75 1.75 0 0 0 2.5 5.5v7A1.75 1.75 0 0 0 4.25 14H7" />
        </>
      );
      break;
    case 'calendar':
      content = (
        <>
          <rect x="3" y="4.5" width="14" height="12.25" rx="2.25" />
          <path d="M6.5 2.75v3.5M13.5 2.75v3.5M3 8.25h14" />
        </>
      );
      break;
    case 'download':
      content = (
        <>
          <path d="M10 3v9.25M5.75 8.25 10 12.5l4.25-4.25" />
          <path d="M3.25 16.75h13.5" />
        </>
      );
      break;
    case 'eye':
      content = (
        <>
          <path d="M2.5 10s2.8-5 7.5-5 7.5 5 7.5 5-2.8 5-7.5 5-7.5-5-7.5-5Z" />
          <circle cx="10" cy="10" r="2.25" />
        </>
      );
      break;
    case 'eye-off':
      content = (
        <>
          <path d="M3 3l14 14M7.2 5.45A8.6 8.6 0 0 1 10 5c4.7 0 7.5 5 7.5 5a12 12 0 0 1-2.4 2.95M12.8 14.55A8.6 8.6 0 0 1 10 15c-4.7 0-7.5-5-7.5-5a12.2 12.2 0 0 1 3.1-3.45" />
        </>
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
