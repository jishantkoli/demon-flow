export function getTheme(): 'light' | 'dark' {
  return 'light';
}
export function setTheme(theme: 'light' | 'dark') {
  localStorage.setItem('theme', 'light');
  document.documentElement.classList.remove('dark');
}
export function initTheme() {
  document.documentElement.classList.remove('dark');
}
