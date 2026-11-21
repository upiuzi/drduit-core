import { useBrand } from '../../brand-context'

export interface FirstRunMarkProps {
  size?: 'sm' | 'lg'
}

export function FirstRunMark({ size = 'sm' }: FirstRunMarkProps) {
  const brand = useBrand()
  const px = size === 'lg' ? 28 : 22
  return (
    <div className={`firstrun-mark${size === 'lg' ? ' firstrun-mark--lg' : ''}`}>
      <img
        className="firstrun-mark__icon"
        src={brand.logo_url || '/logo-mark.svg?v=facet-solid'}
        width={px}
        height={px}
        data-builtin-logo={!brand.logo_url || undefined}
        alt=""
        aria-hidden="true"
      />
      <span className="firstrun-mark__word">{brand.app_name}</span>
    </div>
  )
}
