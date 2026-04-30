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
