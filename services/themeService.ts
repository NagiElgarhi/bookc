import { ColorTheme } from '../types';

// Function to convert HSL to Hex
export const hslToHex = (h: number, s: number, l: number): string => {
    l /= 100;
    const a = s * Math.min(l, 1 - l) / 100;
    const f = (n: number) => {
        const k = (n + h / 30) % 12;
        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
};

export const generateTheme = (hue: number, mode: 'light' | 'dark'): ColorTheme => {
    if (mode === 'dark') {
        return {
            // Dark Navy Blue to Turquoise theme
            '--color-background-primary': '#0d1b2a',
            '--color-background-secondary': '#1b263b',
            '--color-background-tertiary': '#2a364b',
            '--color-border-primary': '#415a77',
            '--color-border-secondary': '#778da9',
            '--color-text-primary': '#f5f5f5', 
            '--color-text-secondary': '#e0e0e0',
            '--color-text-tertiary': '#bdbdbd',
            '--color-text-brown-dark': '#e0e0e0', 
            '--color-text-green-dark': '#a5d6a7',
            '--color-accent-primary': '#FFC107',
            '--color-accent-secondary': '#81C784',
            '--color-accent-info': '#4FC3F7',
            '--color-accent-danger': '#E57373',
            '--color-accent-success': '#81C784',
            '--color-accent-indigo': '#9575CD',
            '--color-accent-purple': '#BA68C8',
            '--color-background-dots': `rgba(255, 255, 255, 0.04)`,
            '--color-accent-highlight': 'rgba(255, 193, 7, 0.1)',
            '--color-background-container-gradient': 'linear-gradient(145deg, #1b263b, #2a364b)',
            '--background-body': 'linear-gradient(to bottom, #0d1b2a, #40e0d0)',
        };
    }

    // Grayscale Light Mode
    return {
        '--color-background-primary': '#ffffff',
        '--color-background-secondary': '#f8f9fa',
        '--color-background-tertiary': '#e9ecef',
        '--color-border-primary': '#dee2e6',
        '--color-border-secondary': '#ced4da',
        '--color-text-primary': '#212529',
        '--color-text-secondary': '#495057',
        '--color-text-tertiary': '#6c757d',
        '--color-text-brown-dark': '#343a40',
        '--color-text-green-dark': '#285430',
        '--color-accent-primary': '#b8860b',
        '--color-accent-secondary': '#5a9a5d',
        '--color-accent-info': '#0d6efd',
        '--color-accent-danger': '#dc3545',
        '--color-accent-success': '#198754',
        '--color-accent-indigo': '#6610f2',
        '--color-accent-purple': '#6f42c1',
        '--color-background-dots': 'rgba(0, 0, 0, 0.05)',
        '--color-accent-highlight': '#fff3cd',
        '--color-background-container-gradient': 'linear-gradient(145deg, #f8f9fa, #e9ecef)',
        '--background-body': 'linear-gradient(to bottom, #343a40, #ffffff)',
    };
};