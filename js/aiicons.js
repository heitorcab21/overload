// Ícones simplificados de cada IA, nas cores da marca.
export const PROVIDER_ICON = {
  claude: '<svg class="ic prov" viewBox="0 0 24 24" aria-hidden="true"><g stroke="#D97757" stroke-width="2.4" stroke-linecap="round">'
    + [0, 45, 90, 135, 180, 225, 270, 315].map((a, i) => `<line x1="12" y1="12" x2="12" y2="${i % 2 ? 4.5 : 2.5}" transform="rotate(${a + (i % 2 ? 8 : 0)} 12 12)"/>`).join('')
    + '</g></svg>',
  gemini: '<svg class="ic prov" viewBox="0 0 24 24" aria-hidden="true"><defs><linearGradient id="gemG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1A73E8"/><stop offset=".6" stop-color="#4C8DF6"/><stop offset="1" stop-color="#8E9CF5"/></linearGradient></defs>'
    + '<path fill="url(#gemG)" d="M12 2c.6 5.4 4.6 9.4 10 10-5.4.6-9.4 4.6-10 10-.6-5.4-4.6-9.4-10-10 5.4-.6 9.4-4.6 10-10z"/></svg>',
  openai: '<svg class="ic prov" viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="#10A37F" stroke-width="1.9">'
    + [0, 60, 120].map(a => `<ellipse cx="12" cy="12" rx="4" ry="9" transform="rotate(${a} 12 12)"/>`).join('') + '</g></svg>',
  // Grok: círculo cortado por uma barra diagonal, na cor do texto
  xai: '<svg class="ic prov" viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M16.5 5.2A8 8 0 1 0 19 13"/><path d="M5 20 20 4"/></g></svg>',
  // DeepSeek: baleia azul
  deepseek: '<svg class="ic prov" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4D6BFE" d="M2.5 12.5c0-3.6 3.8-6.5 8.6-6.5 3.9 0 7 1.8 8.1 4.4.4-.9 1.2-1.6 2.3-1.9-.3 1.4-.9 2.6-1.8 3.4.1 3.4-3.6 6.6-8.6 6.6-4.8 0-8.6-2.4-8.6-6z"/><circle cx="8.3" cy="11" r="1.1" fill="#fff"/><path d="M11 14.2c1.4.6 3 .6 4.4-.1" fill="none" stroke="#fff" stroke-width="1.3" stroke-linecap="round"/></svg>',
  // Perplexity: estrela geométrica verde-azulada
  perplexity: '<svg class="ic prov" viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="#20808D" stroke-width="1.9" stroke-linejoin="round"><path d="M12 2v20"/><path d="M4 6.5 12 11l8-4.5"/><path d="M4 6.5v8.5l8-4 8 4V6.5"/><path d="M7 18.5 12 15l5 3.5"/></g></svg>',
};
