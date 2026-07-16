import type { ReactNode, SVGProps } from 'react';
import type { IconProps } from './types';

interface IconBaseProps extends IconProps {
  viewBox?: string;
  children: ReactNode;
}

/**
 * IconBase
 * --------
 * Wrapper común para todos los iconos SVG del proyecto.
 * Aplica props por defecto y estilos consistentes.
 *
 * Filosofía "Lucide-style":
 *   - viewBox="0 0 24 24" por defecto
 *   - stroke="currentColor" para heredar el color del padre CSS
 *   - fill="none" por defecto (line icons)
 *   - strokeLinecap="round" y strokeLinejoin="round" para bordes suaves
 */
export function IconBase({
  size = 16,
  color,
  strokeWidth = 2,
  filled = false,
  viewBox = '0 0 24 24',
  title,
  children,
  ...rest
}: IconBaseProps) {
  const svgProps: SVGProps<SVGSVGElement> = {
    xmlns: 'http://www.w3.org/2000/svg',
    width: size,
    height: size,
    viewBox,
    fill: filled ? (color ?? 'currentColor') : 'none',
    stroke: filled ? 'none' : (color ?? 'currentColor'),
    strokeWidth,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    role: title ? 'img' : 'presentation',
    'aria-hidden': title ? undefined : true,
    ...rest,
  };

  return (
    <svg {...svgProps}>
      {title && <title>{title}</title>}
      {children}
    </svg>
  );
}