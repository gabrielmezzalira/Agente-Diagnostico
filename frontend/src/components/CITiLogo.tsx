import citiLogo from '../assets/citi-logo.png'

export default function CITiLogo({ height = 22 }: { height?: number }) {
  return (
    <img
      src={citiLogo}
      alt="CITi"
      height={height}
      style={{ height, width: 'auto', filter: 'brightness(0) invert(1)' }}
    />
  )
}
