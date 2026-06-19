import { describe, it, expect } from 'vitest';

describe('@noopjs/cli', () => {
  it('exports runCommand function', async () => {
    const mod = await import('../src/index');
    expect(typeof mod.runCommand).toBe('function');
    expect(typeof mod.printHelp).toBe('function');
  });

  it('printHelp shows usage', async () => {
    const logs: string[] = [];
    const origLog = console.log;
    console.log = (...args: any[]) => logs.push(args.join(' '));

    const { printHelp } = await import('../src/index');
    printHelp();

    console.log = origLog;
    expect(logs.some((l) => l.includes('Usage:'))).toBe(true);
  });
});
