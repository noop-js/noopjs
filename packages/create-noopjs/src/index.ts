import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { createInterface } from 'readline';

const __dirname = dirname(fileURLToPath(import.meta.url));
const templatesDir = existsSync(resolve(__dirname, '..', 'src', 'templates'))
  ? resolve(__dirname, '..', 'src', 'templates')
  : resolve(__dirname, 'templates');

function ask(query: string, defaultVal?: string): Promise<string> {
  const rl = createInterface({ input: process.stdin as any, output: process.stdout as any });
  return new Promise(resolve => {
    rl.question(defaultVal ? `${query} (${defaultVal}) ` : `${query} `, (answer: string) => {
      rl.close();
      resolve(answer.trim() || defaultVal || '');
    });
  });
}

function copyTemplate(srcDir: string, destDir: string, vars: Record<string, string>): void {
  const entries = readdirSync(srcDir, { withFileTypes: true });
  mkdirSync(destDir, { recursive: true });

  for (const entry of entries) {
    const srcPath = join(srcDir, entry.name);
    const destPath = join(destDir, entry.name.replace(/\.template$/, ''));

    if (entry.isDirectory()) {
      copyTemplate(srcPath, destPath, vars);
    } else {
      let content = readFileSync(srcPath, 'utf-8');
      for (const [key, val] of Object.entries(vars)) {
        content = content.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), val);
      }
      writeFileSync(destPath, content);
    }
  }
}

export async function run(): Promise<void> {
  const projectDir = process.argv[2] || await ask('Where should we create your project?', '.');
  const template = process.argv[3] || await ask('Which template? (counter, blog, empty)', 'counter');
  const name = process.argv[4] || projectDir === '.' ? 'my-noop-app' : projectDir;

  const dest = resolve(process.cwd(), projectDir === '.' ? '.' : projectDir);
  const templateDir = resolve(templatesDir, template);

  if (!existsSync(templateDir)) {
    console.error(`Template "${template}" not found. Available: counter, blog, empty`);
    process.exit(1);
  }

  if (existsSync(dest) && readdirSync(dest).length > 0 && dest !== process.cwd()) {
    const ok = await ask(`Directory ${dest} is not empty. Continue? (y/n)`, 'n');
    if (ok !== 'y') { console.log('Aborted.'); process.exit(0); }
  }

  copyTemplate(templateDir, dest, { name, projectDir: name });

  console.log(`\nCreated ${name} at ${dest}\n`);
  console.log('  cd ' + (projectDir === '.' ? '.' : projectDir));
  console.log('  npm install');
  console.log('  npm run dev\n');
}
