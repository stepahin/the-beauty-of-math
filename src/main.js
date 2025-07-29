import './style.css'
import { MasonryGallery } from './gallery.js'

// Initialize app
document.getElementById('app').innerHTML = `
  <div class="top-controls">
    <div class="load-counter">
      <span id="loadedCount">0</span> / <span id="totalCount">0</span>
    </div>
    <button id="themeToggle" class="theme-toggle" aria-label="Toggle theme">
      <svg class="theme-icon light" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="5"></circle>
        <line x1="12" y1="1" x2="12" y2="3"></line>
        <line x1="12" y1="21" x2="12" y2="23"></line>
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
        <line x1="1" y1="12" x2="3" y2="12"></line>
        <line x1="21" y1="12" x2="23" y2="12"></line>
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
      </svg>
      <svg class="theme-icon dark" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
      </svg>
    </button>
  </div>

  <div class="header">
    <h1 class="main-title">The Beauty of&nbsp;Math</h1>
    <div class="attribution">
      <p>All images from <a href="https://mathworld.wolfram.com" target="_blank">Wolfram MathWorld</a>, assembled by Eric W. Weisstein.</p>
      <p>All rights belong to Wolfram Research, Inc.</p>
    </div>
  </div>

  <div class="masonry-container">
    <div id="masonryGrid" class="masonry-grid"></div>
    <div id="loader" class="loader" style="display: none;">
      <div class="terminal-loader">
        <span class="loading-text">Loading images</span>
        <span class="loading-indicator">⠋</span>
      </div>
    </div>
  </div>

`

// Start gallery
const gallery = new MasonryGallery(__SVG_FILES__)
gallery.init()

// Theme toggle
const themeToggle = document.getElementById('themeToggle')
const body = document.body

// Определяем системную тему
const getSystemTheme = () => {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

// Check saved theme or default to system theme
const savedTheme = localStorage.getItem('theme') || getSystemTheme()
body.setAttribute('data-theme', savedTheme)

// Слушаем изменения системной темы
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!localStorage.getItem('theme')) {
        body.setAttribute('data-theme', e.matches ? 'dark' : 'light')
    }
})

themeToggle.addEventListener('click', () => {
    const currentTheme = body.getAttribute('data-theme')
    const newTheme = currentTheme === 'light' ? 'dark' : 'light'
    
    body.setAttribute('data-theme', newTheme)
    localStorage.setItem('theme', newTheme)
})