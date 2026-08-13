/**
 * Generates a random alphanumeric captcha and its SVG string representation.
 * @returns {Object} { text: String (lowercase), svg: String }
 */
const generateCaptcha = () => {
  // Excluding confusing characters like 0, O, o, 1, l, I
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz';
  let text = '';
  for (let i = 0; i < 5; i++) {
    text += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  const width = 150;
  const height = 48;
  
  // Generate random lines for noise
  let lines = '';
  for (let i = 0; i < 4; i++) {
    const x1 = Math.floor(Math.random() * width);
    const y1 = Math.floor(Math.random() * height);
    const x2 = Math.floor(Math.random() * width);
    const y2 = Math.floor(Math.random() * height);
    const colors = ['#cbd5e1', '#94a3b8', '#64748b', '#475569'];
    const color = colors[Math.floor(Math.random() * colors.length)];
    lines += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${Math.floor(Math.random() * 2) + 1}" />`;
  }
  
  // Generate random dots for noise
  let dots = '';
  for (let i = 0; i < 35; i++) {
    const cx = Math.floor(Math.random() * width);
    const cy = Math.floor(Math.random() * height);
    const r = Math.floor(Math.random() * 2) + 1;
    dots += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#94a3b8" opacity="0.4" />`;
  }

  // Draw characters with random styling
  let textElements = '';
  const charWidth = width / 6;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const x = 12 + i * charWidth + (Math.random() * 6 - 3);
    const y = 32 + (Math.random() * 6 - 3);
    const angle = Math.floor(Math.random() * 40) - 20; // rotation between -20 and 20 degrees
    const fontSizes = [22, 24, 26, 28];
    const fontSize = fontSizes[Math.floor(Math.random() * fontSizes.length)];
    const colors = ['#003175', '#0047a1', '#006876', '#1e293b', '#0f172a'];
    const color = colors[Math.floor(Math.random() * colors.length)];
    
    textElements += `<text x="${x}" y="${y}" fill="${color}" font-size="${fontSize}" font-family="Inter, system-ui, sans-serif" font-weight="bold" transform="rotate(${angle}, ${x}, ${y})">${char}</text>`;
  }

  const svg = `<svg width="100%" height="100%" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" style="background: #f1f5f9; border-radius: 8px; border: 1px solid #cbd5e1; user-select: none;">
    ${lines}
    ${dots}
    ${textElements}
  </svg>`;

  return {
    text: text.toLowerCase(),
    svg: svg
  };
};

module.exports = { generateCaptcha };
