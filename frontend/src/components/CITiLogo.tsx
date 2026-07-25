import citiLogo from '../assets/citi-logo.png'

export default function CITiLogo({ height = 22 }: { height?: number }) {
  return (
    <img
      src={citiLogo}
      alt="CITi"
      height={height}
      style={{
        height,
        width: 'auto',
        // white logo → roxo CITi #7D1AD7
        filter:
          'brightness(0) saturate(100%) invert(14%) sepia(94%) saturate(4000%) hue-rotate(268deg) brightness(90%)',
      }}
    />
  )
}
