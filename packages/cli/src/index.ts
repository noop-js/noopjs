import { createServer, build, preview } from 'vite';
import { noopVite } from '@noopjs/vite';
import { resolve } from 'path';

export type Command = 'dev' | 'build' | 'preview' | 'generate' | 'analyze' | 'check' | 'init';

export async function runCommand(command?: Command, args: string[] = []) {
  switch (command) {
    case 'dev': {
      await startDev();
      break;
    }
    case 'build': {
      await runBuild();
      break;
    }
    case 'preview': {
      await runPreview();
      break;
    }
    case 'generate': {
      await runGenerate(args);
      break;
    }
    case 'analyze': {
      await runAnalyze();
      break;
    }
    case 'check': {
      await runCheck();
      break;
    }
    case 'init': {
      await runInit();
      break;
    }
    default: {
      printHelp();
      return;
    }
  }
}

export function printHelp() {
  console.log('NoopJS — zero-runtime resumable web framework');
  console.log('');
  console.log('Usage:');
  console.log('  noopjs dev              Start development server');
  console.log('  noopjs build            Build for production');
  console.log('  noopjs preview          Preview production build');
  console.log('  noopjs generate <type>  Scaffold a component (component, page)');
  console.log('  noopjs analyze          Bundle size report');
  console.log('  noopjs check            Type-check all .noop files');
  console.log('  noopjs init             Initialize a new project');
  console.log('');
}

async function runGenerate(args: string[]) {
  const type = args[0] || 'component';
  const name = args[1] || 'MyComponent';

  switch (type) {
    case 'component': {
      const fs = await import('fs');
      const path = await import('path');
      const filePath = path.resolve(process.cwd(), 'src', `${name}.noop.tsx`);
      const content = `export default function ${name}(props, __noopId) {
  return <div>${name}</div>;
}
`;
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, content);
      console.log(`Created ${filePath}`);
      break;
    }
    case 'page': {
      const fs = await import('fs');
      const path = await import('path');
      const filePath = path.resolve(process.cwd(), 'src', 'pages', `${name}.noop.tsx`);
      const content = `export default function ${name}(props, __noopId) {
  return <div>
    <h1>${name}</h1>
    {props.children}
  </div>;
}
`;
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, content);
      console.log(`Created ${filePath}`);
      break;
    }
    default: {
      console.log('Unknown type. Use: component, page');
    }
  }
}

async function runAnalyze() {
  const fs = await import('fs');
  const path = await import('path');
  const distDir = path.resolve(process.cwd(), 'dist');

  if (!fs.existsSync(distDir)) {
    console.log('No dist directory found. Run "noopjs build" first.');
    return;
  }

  console.log('Noop Bundle Analysis');
  console.log('----------------------');

  function walk(dir: string): { file: string; size: number }[] {
    const results: { file: string; size: number }[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...walk(full));
      } else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.css'))) {
        const stat = fs.statSync(full);
        results.push({ file: full.replace(distDir, ''), size: stat.size });
      }
    }
    return results;
  }

  const files = walk(distDir);
  let totalSize = 0;

  for (const f of files.sort((a, b) => b.size - a.size)) {
    const sizeKb = (f.size / 1024).toFixed(1);
    console.log(`  ${sizeKb.padStart(7)} KB  ${f.file}`);
    totalSize += f.size;
  }

  console.log(`----------------------`);
  console.log(`  ${(totalSize / 1024).toFixed(1)} KB  total`);
}

async function runCheck() {
  const fs = await import('fs');
  const path = await import('path');
  const { compile } = await import('@noopjs/compiler');

  const srcDir = path.resolve(process.cwd(), 'src');
  if (!fs.existsSync(srcDir)) {
    console.log('No src directory found.');
    return;
  }

  const files = fs.readdirSync(srcDir).filter((f: string) => f.endsWith('.noop.tsx') || f.endsWith('.noop.ts'));
  let errors = 0;

  for (const file of files) {
    const filePath = path.join(srcDir, file);
    try {
      const source = fs.readFileSync(filePath, 'utf-8');
      compile(source, { filename: filePath });
      console.log(`  ✓ ${file}`);
    } catch (e: any) {
      console.log(`  ✗ ${file}: ${e.message}`);
      errors++;
    }
  }

  if (errors === 0) {
    console.log(`\nAll ${files.length} files OK`);
  } else {
    console.log(`\n${errors} file(s) with errors`);
  }
}

async function runInit() {
  const fs = await import('fs');
  const path = await import('path');
  const root = process.cwd();

  // Create basic project structure
  const dirs = ['src', 'public'];
  for (const d of dirs) {
    fs.mkdirSync(path.resolve(root, d), { recursive: true });
  }

  // Create package.json if it doesn't exist
  const pkgPath = path.resolve(root, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    const pkg = {
      name: 'my-aether-app',
      version: '0.1.0',
      type: 'module',
      scripts: {
        dev: 'noopjs dev',
        build: 'noopjs build',
        preview: 'noopjs preview',
      },
      dependencies: {
        '@noopjs/runtime': 'latest',
        '@noopjs/signals': 'latest',
      },
      devDependencies: {
        '@noopjs/vite': 'latest',
        vite: '^6.0.0',
      },
    };
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
    console.log('Created package.json');
  }

  // Create main entry
  const mainPath = path.resolve(root, 'src', 'main.noop.tsx');
  if (!fs.existsSync(mainPath)) {
    fs.writeFileSync(mainPath, `import { signal } from '@noopjs/signals';

const count = signal(0);

export default function App(props, __noopId) {
  return <div>
    <h1>Hello Noop!</h1>
    <p>Count: {count}</p>
    <button onClick={() => count.set(count.get() + 1)}>+</button>
  </div>;
}
`);
    console.log('Created src/main.noop.tsx');
  }

  // Create index.html
  const htmlPath = path.resolve(root, 'index.html');
  if (!fs.existsSync(htmlPath)) {
    fs.writeFileSync(htmlPath, `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Noop App</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.noop.tsx"></script>
</body>
</html>
`);
    console.log('Created index.html');
  }

  console.log('\nProject initialized! Run: noopjs dev');
}

async function startDev() {
  const root = process.cwd();

  const server = await createServer({
    root,
    plugins: [noopVite()],
    server: {
      port: 3000,
      open: true,
    },
  });

  await server.listen();
  server.printUrls();
}

async function runBuild() {
  const root = process.cwd();

  await build({
    root,
    plugins: [noopVite()],
  });

  // Also run SSR build if src/entry-server.ts exists
  try {
    const fs = await import('fs');
    if (fs.existsSync(resolve(root, 'src/entry-server.ts'))) {
      await build({
        root,
        plugins: [noopVite({ ssr: true })],
        build: {
          ssr: resolve(root, 'src/entry-server.ts'),
          outDir: resolve(root, 'dist/server'),
        },
      });
    }
  } catch {
    // No SSR entry, client-only build
  }

  console.log('Build complete. Output in ./dist');
}

async function runPreview() {
  const root = process.cwd();

  const server = await preview({
    root,
    plugins: [noopVite()],
  });

  server.printUrls();
}
