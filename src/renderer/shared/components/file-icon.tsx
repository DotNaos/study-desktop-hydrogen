import { FileIcon as PrimitiveFileIcon } from '@react-symbols/icons/utils';
import type { CSSProperties } from 'react';
import { cn } from '../lib/utils';

interface FileIconProps {
    filename: string;
    className?: string;
    style?: CSSProperties;
    size?: number | 's' | 'm' | 'l';
    grayscale?: boolean;
    variant?: 'default' | 'powerpoint';
}

export function FileIcon({
    filename,
    className,
    style,
    size = 16,
    grayscale,
    variant = 'default',
}: FileIconProps) {
    const pixelSize =
        typeof size === 'string'
            ? size === 's'
                ? 16
                : size === 'm'
                  ? 20
                  : 24
            : size;

    return (
        <span
            className={cn(
                'relative inline-flex shrink-0',
                grayscale && 'grayscale opacity-80',
                className,
            )}
            style={style}
        >
            <PrimitiveFileIcon
                fileName={filename}
                autoAssign={true}
                width={pixelSize}
                height={pixelSize}
            />
            {variant === 'powerpoint' && (
                <span
                    className="absolute -bottom-0.5 -right-0.5 flex h-2.5 min-w-2.5 items-center justify-center rounded-[3px] bg-orange-500 px-[2px] text-[6px] font-bold leading-none text-white shadow-sm"
                    aria-hidden="true"
                >
                    P
                </span>
            )}
        </span>
    );
}
