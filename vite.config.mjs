import { svelte } from '@sveltejs/vite-plugin-svelte';
import { resolve } from 'path';
import fs from 'fs';
import path from 'path';

// Function to copy directory recursively
function copyDir(src, dest) {
	if (!fs.existsSync(dest)) {
		fs.mkdirSync(dest, { recursive: true });
	}

	const entries = fs.readdirSync(src, { withFileTypes: true });

	for (const entry of entries) {
		const srcPath = path.join(src, entry.name);
		const destPath = path.join(dest, entry.name);

		if (entry.isDirectory()) {
			copyDir(srcPath, destPath);
		} else {
			fs.copyFileSync(srcPath, destPath);
		}
	}
}

/** @type {import('vite').UserConfig} */
const config = {
	plugins: [
		svelte(),
		// Custom plugin to copy templates directory
		{
			name: 'copy-templates',
			closeBundle() {
				// Copy templates folder
				const templatesDir = resolve('templates');
				const destTemplatesDir = resolve('dist', 'templates');

				if (fs.existsSync(templatesDir)) {
					copyDir(templatesDir, destTemplatesDir);
					console.log('Templates directory copied to dist/templates');
				}

				// Copy lang folder
				const langDir = resolve('lang');
				const destLangDir = resolve('dist', 'lang');

				if (fs.existsSync(langDir)) {
					copyDir(langDir, destLangDir);
					console.log('Language directory copied to dist/lang');
				}

				// Copy module.json
				fs.copyFileSync(resolve('module.json'), resolve('dist', 'module.json'));
				console.log('module.json copied to dist/');
			}
		}
	], build: {
		lib: {
			entry: resolve('src', 'index.ts'),
			name: 'MaleficarManoeuvres',
			formats: ['iife'],
			fileName: () => 'module.js',
		},
		outDir: 'dist',
		emptyOutDir: true,
		rollupOptions: {
			output: {
				assetFileNames: (assetInfo) => {
					const name = assetInfo?.fileName || '';
					if (name.endsWith('.css')) {
						return 'modules.css';
					}
					return '[name][extname]';
				},
			},
		},
	},
	publicDir: 'public'
};

export default config;
