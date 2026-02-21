import {
    cp,
    lstat,
    mkdir,
    readFile,
    readdir,
    realpath,
    unlink,
} from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appDir = path.resolve(__dirname, '..');
const repoRoot = path.resolve(appDir, '..', '..', '..');
const appNodeModulesDir = path.join(appDir, 'node_modules');
const rootNodeModulesDir = path.join(repoRoot, 'node_modules');
const orgScope = '@aryazos';
const orgNodeModulesDir = path.join(appDir, 'node_modules', orgScope);

const shouldCopy = (sourceRoot, sourcePath, { excludeNodeModules }) => {
    if (sourcePath === sourceRoot) {
        return true;
    }

    const relative = path.relative(sourceRoot, sourcePath);
    const segments = relative.split(path.sep);
    return !excludeNodeModules || !segments.includes('node_modules');
};

const ensureRealPackage = async (packagePath, { excludeNodeModules }) => {
    const stats = await lstat(packagePath);
    if (!stats.isSymbolicLink()) {
        return;
    }

    let sourceRoot;
    try {
        sourceRoot = await realpath(packagePath);
    } catch (error) {
        // Broken symlink - just delete it
        if (error && error.code === 'ENOENT') {
            await unlink(packagePath);
            return;
        }
        throw error;
    }

    await unlink(packagePath);
    await cp(sourceRoot, packagePath, {
        recursive: true,
        dereference: true,
        filter: (sourcePath) =>
            shouldCopy(sourceRoot, sourcePath, { excludeNodeModules }),
    });
};

const resolveModuleDir = (baseDir, depName) => {
    if (!depName.startsWith('@')) {
        return path.join(baseDir, depName);
    }

    const [scope, name] = depName.split('/');
    return path.join(baseDir, scope, name);
};

const ensureDependency = async (depName) => {
    const targetPath = resolveModuleDir(appNodeModulesDir, depName);
    try {
        await ensureRealPackage(targetPath, { excludeNodeModules: true });
        return;
    } catch (error) {
        if (!error || error.code !== 'ENOENT') {
            throw error;
        }
    }

    const sourcePath = resolveModuleDir(rootNodeModulesDir, depName);
    try {
        await lstat(sourcePath);
    } catch (error) {
        if (error && error.code === 'ENOENT') {
            return;
        }
        throw error;
    }

    await mkdir(path.dirname(targetPath), { recursive: true });
    await cp(sourcePath, targetPath, {
        recursive: true,
        dereference: true,
        filter: (sourcePathEntry) =>
            shouldCopy(sourcePath, sourcePathEntry, {
                excludeNodeModules: false,
            }),
    });
};

const main = async () => {
    const packageJson = JSON.parse(
        await readFile(path.join(appDir, 'package.json'), 'utf8')
    );
    const dependencies = {
        ...(packageJson.dependencies ?? {}),
        ...(packageJson.optionalDependencies ?? {}),
    };

    await Promise.all(
        Object.keys(dependencies).map((dep) => ensureDependency(dep))
    );

    let entries;
    try {
        entries = await readdir(orgNodeModulesDir, { withFileTypes: true });
    } catch (error) {
        if (error && error.code === 'ENOENT') {
            return;
        }
        throw error;
    }

    const tasks = entries
        .filter((entry) => entry.isSymbolicLink() || entry.isDirectory())
        .map((entry) =>
            ensureRealPackage(path.join(orgNodeModulesDir, entry.name), {
                excludeNodeModules: true,
            })
        );

    await Promise.all(tasks);
};

await main();
