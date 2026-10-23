// Visual themes. Each theme drives the wheel renderer (palette, rim, LEDs, decoration) and the page CSS.
export const THEMES = {
  gold: { name: 'کازینوی طلایی', emoji: '🎰', palette: ['#b3001b', '#151515', '#0b6e4f', '#b3001b', '#151515', '#7a0a2e'], text: '#ffe7a3', textStroke: 'rgba(0,0,0,.55)',
    rim: ['#fff2b0', '#d4a017', '#7a5200', '#f7d774', '#8a5a00'], led: '#ffd76a', ledOff: '#5a3d00', sep: '#e8c25a', bg: ['#2a0610', '#0c0205'], accent: '#f5c542', deco: 'none', hub: ['#fff6c7', '#d6a21c', '#7a5200'] },
  neon: { name: 'نئون', emoji: '💜', palette: ['#ff2bd6', '#00d5ff', '#7cff3a', '#ffe600', '#ff6b00', '#9d4dff'], text: '#ffffff', textStroke: 'rgba(0,0,0,.6)',
    rim: ['#3a3f5c', '#151827', '#5a6185', '#0b0d17', '#2c3150'], led: '#00f0ff', ledOff: '#0d2b33', sep: '#0b0d17', bg: ['#130a2e', '#030112'], accent: '#ff2bd6', deco: 'neon', hub: ['#5a6185', '#1b1f33', '#05060c'] },
  candy: { name: 'آب‌نبات', emoji: '🍭', palette: ['#ff6fa8', '#ffd23f', '#3ee0b8', '#6f9dff', '#ff9a5c', '#b77dff'], text: '#ffffff', textStroke: 'rgba(90,20,60,.45)',
    rim: ['#ffffff', '#ffc2dc', '#ff6fa8', '#ffe1ee', '#e04f8c'], led: '#fffbe0', ledOff: '#c9407a', sep: '#ffffff', bg: ['#ff9ccb', '#7b4dff'], accent: '#ff3d8b', deco: 'dots', hub: ['#ffffff', '#ffb3d1', '#e04f8c'] },
  pastel: { name: 'پاستلی', emoji: '🌸', palette: ['#ffc8d7', '#bfe6e0', '#fff0a8', '#d5c4ff', '#ffd9b0', '#c3e2ff'], text: '#4a3b5c', textStroke: 'rgba(255,255,255,.7)',
    rim: ['#ffffff', '#efe6ff', '#c9b8ef', '#fbf7ff', '#a995d6'], led: '#fff6c2', ledOff: '#cbbbe8', sep: '#ffffff', bg: ['#fdf0f6', '#e3ecff'], accent: '#a07be0', deco: 'none', hub: ['#ffffff', '#f2eaff', '#b9a6e6'], light: true },
  galaxy: { name: 'کهکشان', emoji: '🌌', palette: ['#2b1055', '#4b6cb7', '#d53369', '#3a1c71', '#7b2ff7', '#0f3460'], text: '#ffffff', textStroke: 'rgba(0,0,0,.6)',
    rim: ['#c9d6ff', '#4b4f7a', '#1a1b35', '#8f9bd6', '#2a2c55'], led: '#b9c7ff', ledOff: '#202245', sep: 'rgba(255,255,255,.35)', bg: ['#1a0b3d', '#02010a'], accent: '#8f7bff', deco: 'stars', hub: ['#e0e6ff', '#5b63a8', '#141532'] },
  kashi: { name: 'کاشی ایرانی', emoji: '🕌', palette: ['#0d4fa0', '#17a3b5', '#f3eedb', '#0b3d91', '#d99a1e', '#12808f'], text: '#ffffff', textStroke: 'rgba(0,20,60,.6)', textOn: { '#f3eedb': '#0d3d7a' },
    rim: ['#fdf3c4', '#c9952b', '#6b4a10', '#f0cf6a', '#7a5414'], led: '#9ff3ff', ledOff: '#0d4b5a', sep: '#f0cf6a', bg: ['#0a3a6b', '#041a33'], accent: '#17c3d6', deco: 'girih', hub: ['#e7fbff', '#17a3b5', '#0b3d6b'] },
  cat: { name: 'گربه‌ای', emoji: '🐱', palette: ['#ff9f87', '#ffd6a5', '#e5989b', '#b5838d', '#ffcad4', '#f6bd60'], text: '#4a2a2a', textStroke: 'rgba(255,255,255,.6)',
    rim: ['#fff4ea', '#f4c7a1', '#a8705a', '#ffe8d4', '#8c5a46'], led: '#fff0c9', ledOff: '#b9866d', sep: '#fff4ea', bg: ['#ffd9c7', '#c98a7a'], accent: '#e76f51', deco: 'paws', hub: ['#fff9f3', '#f4c7a1', '#a8705a'], light: true },
};
export const THEME_IDS = Object.keys(THEMES);
export const themeOf = (id) => THEMES[id] || THEMES.gold;

export const POINTERS = {
  classic: { name: 'کلاسیک', emoji: '🔻', price: 0 },
  gavel: { name: 'چکش قضاوت', emoji: '⚖️', price: 120 },
  paw: { name: 'پنجه‌ی گربه', emoji: '🐾', price: 100 },
  crown: { name: 'تاج', emoji: '👑', price: 200 },
  diamond: { name: 'الماس', emoji: '💎', price: 350 },
};
