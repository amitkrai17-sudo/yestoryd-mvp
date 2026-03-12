'use client';

import Image from 'next/image';

interface AvatarProps {
  name: string;
  size?: 'sm' | 'md' | 'lg';
  portal?: 'parent' | 'coach' | 'admin';
  src?: string;
  className?: string;
}

const SIZE_CLASSES = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-14 h-14 text-lg',
};

const SIZE_PX = { sm: 32, md: 40, lg: 56 };

const GRADIENT_CLASSES = {
  parent: 'bg-gradient-to-br from-pink-400 to-pink-600',
  coach: 'bg-gradient-to-br from-[#00ABFF] to-[#0066CC]',
  admin: 'bg-white/10',
};

export function Avatar({
  name,
  size = 'md',
  portal = 'coach',
  src,
  className = '',
}: AvatarProps) {
  const initial = name.charAt(0).toUpperCase();
  const sizeClass = SIZE_CLASSES[size];
  const px = SIZE_PX[size];

  if (src) {
    return (
      <Image
        src={src}
        alt={name}
        width={px}
        height={px}
        className={`${sizeClass} rounded-full object-cover flex-shrink-0 ${className}`}
      />
    );
  }

  return (
    <div
      className={`${sizeClass} ${GRADIENT_CLASSES[portal]} rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0 ${className}`}
    >
      {initial}
    </div>
  );
}
