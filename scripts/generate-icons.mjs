import sharp from 'sharp'

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#7c3aed"/>
  <circle cx="116" cy="256" r="80" fill="#ef4444"/>
  <circle cx="256" cy="256" r="80" fill="#eab308"/>
  <circle cx="396" cy="256" r="80" fill="#22c55e"/>
</svg>
`

const svgBuffer = Buffer.from(svg)

await sharp(svgBuffer).resize(192, 192).png().toFile('public/icon-192.png')
await sharp(svgBuffer).resize(512, 512).png().toFile('public/icon-512.png')

console.log('Icons generated.')
