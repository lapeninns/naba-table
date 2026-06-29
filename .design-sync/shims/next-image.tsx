// design-sync preview shim for next/image — renders a plain img.
import * as React from 'react';

const Image = React.forwardRef<HTMLImageElement, any>(function Image(
  { src, alt, width, height, fill, priority, loader, quality, placeholder, blurDataURL, sizes, style, ...rest },
  ref,
) {
  const url = typeof src === 'string' ? src : src?.src || '';
  const fillStyle = fill ? { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' } : null;
  return (
    <img
      ref={ref}
      src={url}
      alt={alt ?? ''}
      width={fill ? undefined : width}
      height={fill ? undefined : height}
      style={{ ...(fillStyle || {}), ...(style || {}) }}
      {...rest}
    />
  );
});

export default Image;
