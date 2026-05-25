/**
 * Copies text to clipboard with a fallback for insecure contexts (HTTP)
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  // Try navigator.clipboard first (Standard, requires secure context)
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.error('Clipboard API failed:', err);
    }
  }

  // Fallback for insecure contexts (HTTP) or when API fails
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    
    // Ensure textarea is not visible but part of the DOM
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    
    textArea.focus();
    textArea.select();
    
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    
    if (successful) return true;
  } catch (err) {
    console.error('Fallback copy failed:', err);
  }

  return false;
}

/**
 * Removes the timestamp prefix and folder path from an uploaded filename
 */
export function getCleanFileName(urlOrPath: string): string {
  if (!urlOrPath) return '';
  // Get filename from path or URL (split by / or \)
  const baseName = String(urlOrPath).split(/[\\/]/).pop() || '';
  // Remove timestamp prefix (e.g., 1778417444108-)
  // Matches a sequence of digits at the start followed by a hyphen
  return baseName.replace(/^\d+-/, '');
}

/**
 * Determines if a color is light (for contrast calculation)
 */
export function isLightColor(color: string): boolean {
  if (!color) return false;
  let r = 0, g = 0, b = 0;
  
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    if (hex.length === 3) {
      r = parseInt(hex[0] + hex[0], 16);
      g = parseInt(hex[1] + hex[1], 16);
      b = parseInt(hex[2] + hex[2], 16);
    } else if (hex.length === 6) {
      r = parseInt(hex.slice(0, 2), 16);
      g = parseInt(hex.slice(2, 4), 16);
      b = parseInt(hex.slice(4, 6), 16);
    }
  } else if (color.startsWith('rgb')) {
    const match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (match) {
      r = parseInt(match[1]);
      g = parseInt(match[2]);
      b = parseInt(match[3]);
    }
  }
  
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 128;
}
