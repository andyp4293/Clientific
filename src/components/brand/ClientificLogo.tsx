import type { CSSProperties } from 'react';
import Image from 'next/image';
import { APP_NAME } from '@/lib/brand';
import { BRAND_LOGO_DARK_SRC, BRAND_LOGO_LIGHT_SRC } from '@/lib/brand-assets';

type ClientificMarkProps = {
  className?: string;
  title?: string;
  style?: CSSProperties;
  priority?: boolean;
};

export function ClientificMark({
  className = 'h-8 w-8',
  title = 'Clientific logo',
  style,
  priority = false,
}: ClientificMarkProps) {
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={style}>
      <Image
        src={BRAND_LOGO_LIGHT_SRC}
        alt={title}
        width={120}
        height={120}
        priority={priority}
        className={`${className} object-contain dark:hidden`}
      />
      <Image
        src={BRAND_LOGO_DARK_SRC}
        alt={title}
        width={120}
        height={120}
        priority={priority}
        className={`${className} hidden object-contain dark:block`}
      />
    </span>
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
  priority?: boolean;
};

export function ClientificLogo({
  className,
  markClassName = 'h-8 w-8',
  nameClassName = 'text-lg font-semibold tracking-tight text-gray-900 dark:text-gray-100',
  showName = true,
  name = APP_NAME,
  title = APP_NAME,
  style,
  priority = false,
}: ClientificLogoProps) {
  return (
    <span className={className} style={style}>
      <ClientificMark className={markClassName} title={title} priority={priority} />
      {showName ? <span className={nameClassName}>{name}</span> : null}
    </span>
  );
}
