import type { CSSProperties, SVGProps } from 'react';
import { APP_NAME } from '@/lib/brand';

type ClientificMarkProps = SVGProps<SVGSVGElement> & {
  title?: string;
};

export function ClientificMark({
  className,
  title = 'Clientific logo',
  ...props
}: ClientificMarkProps) {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label={title}
      {...props}
    >
      <path
        d="M22 74C13 64.7 8 52.3 8 39.5C8 12.1 30.1 0 50.3 0C62.1 0 73.7 4.2 82.8 12L73.6 22.4C67.2 17 59 14 50.4 14C31.2 14 22 26.2 22 39.5C22 48.9 26.6 58 34.4 64.4L22 74Z"
        fill="currentColor"
      />
      <circle cx="50" cy="50" r="14" fill="currentColor" />
      <path
        d="M25.8 74.2L47.9 52.1"
        stroke="currentColor"
        strokeWidth="8.5"
        strokeLinecap="round"
      />
      <path
        d="M59.4 36.8L90.5 5.7"
        stroke="currentColor"
        strokeWidth="8.5"
        strokeLinecap="round"
      />
      <path
        d="M75.6 12.2L96.8 3.2L87.8 24.4L80.3 19.7L75.6 12.2Z"
        fill="currentColor"
      />
      <path
        d="M77.1 28.3C78.8 32.5 79.7 36.9 79.7 41.5C79.7 60.6 64.2 76.1 45.1 76.1C39.7 76.1 34.4 74.8 29.7 72.5L19.2 82.9C26.8 87.4 35.8 90 45.2 90C72.1 90 93.9 68.3 93.9 41.4C93.9 32.8 91.7 24.5 87.4 17.3L77.1 28.3Z"
        fill="currentColor"
      />
    </svg>
  );
}

type ClientificLogoProps = {
  className?: string;
  markClassName?: string;
  nameClassName?: string;
  showName?: boolean;
  name?: string;
  title?: string;
  style?: CSSProperties;
};

export function ClientificLogo({
  className,
  markClassName = 'h-8 w-8',
  nameClassName = 'text-lg font-semibold tracking-tight text-gray-900 dark:text-gray-100',
  showName = true,
  name = APP_NAME,
  title = APP_NAME,
  style,
}: ClientificLogoProps) {
  return (
    <span className={className} style={style}>
      <ClientificMark className={markClassName} title={title} />
      {showName ? <span className={nameClassName}>{name}</span> : null}
    </span>
  );
}
