#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
let babelParser;
try {
  // Lazy require to keep script runnable even if dev dep not installed yet
  // Will only be used by AST-based method extraction
  babelParser = require('@babel/parser');
} catch (_) {
  babelParser = null;
}

class RouteScanner {
  constructor(basePath = 'src/app') {
    this.basePath = path.resolve(basePath);
    this.routes = {
      pages: [],
      api: [],
      other: []
    };
    this.meta = {
      frameworks_detected: ['Next.js 15 App Router'],
      total_routes: 0,
      scanning_notes: [],
      warnings: [],
      timestamp: new Date().toISOString()
    };
  }

  // Scan all page.tsx and route.ts files
  scan() {
    this.scanDirectory(this.basePath, '');
    // Validation: duplicate routes
    const allPaths = [...this.routes.pages.map(r => r.path), ...this.routes.api.map(r => r.path), ...this.routes.other.map(r => r.path)];
    const seen = new Set();
    for (const p of allPaths) {
      if (seen.has(p)) {
        this.meta.warnings.push({ type: 'duplicate_route_path', route: p, message: `Duplicate route path detected: ${p}` });
      } else {
        seen.add(p);
      }
    }
    this.meta.total_routes = this.routes.pages.length + this.routes.api.length + this.routes.other.length;
    // Global middleware detection (effects routing)
    this.scanForMiddleware();
    return this.routes;
  }

  scanDirectory(dirPath, routePath) {
    if (!fs.existsSync(dirPath)) return;

    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      const relativePath = path.relative(this.basePath, fullPath);

      // Skip route groups or intercepting segments in the URL, process contents
      // Next.js groups: (group), intercepting prefixes: (.) (..) (...)
      if (entry.isDirectory() && entry.name.startsWith('(')) {
        this.scanDirectory(fullPath, routePath);
        continue;
      }

      // Skip parallel routes directories (@slot) in URL path but process contents
      if (entry.isDirectory() && entry.name.startsWith('@')) {
        this.scanDirectory(fullPath, routePath);
        continue;
      }

      if (entry.isDirectory()) {
        // Calculate new route path, handling dynamic segments
        let newRoutePath = routePath;
        if (entry.name !== 'api') { // Don't add 'api' to route path for API routes
          newRoutePath = this.normalizePathSegment(entry.name, routePath);
        }
        this.scanDirectory(fullPath, newRoutePath);
      } else if (entry.isFile()) {
        this.processFile(fullPath, relativePath, routePath);
      }
    }
  }

  scanForMiddleware() {
    const candidates = [
      path.resolve(process.cwd(), 'middleware.ts'),
      path.resolve(process.cwd(), 'middleware.js'),
      path.resolve(process.cwd(), 'src/middleware.ts'),
      path.resolve(process.cwd(), 'src/middleware.js'),
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) {
        this.meta.warnings.push({ type: 'middleware_detected', file: path.relative(process.cwd(), p), message: 'Global middleware detected; may affect routing.' });
      }
    }
  }

  processFile(filePath, relativePath, routePath) {
    const fileName = path.basename(filePath);
    
    if (fileName === 'page.tsx') {
      this.processPage(filePath, relativePath, routePath);
    } else if (fileName === 'route.ts') {
      this.processRoute(filePath, relativePath, routePath);
    }
  }

  processPage(filePath, relativePath, routePath) {
    const routeInfo = {
      path: this.normalizeRoutePath(routePath),
      methods: [],
      dynamic: this.isDynamicRoute(routePath),
      groups: this.extractRouteGroups(relativePath),
      guards: this.detectGuards(relativePath),
      source: relativePath,
      description: this.generateDescription(routePath, 'page'),
      params: this.extractParams(routePath),
      config: this.extractRouteConfig(filePath)
    };

    this.routes.pages.push(routeInfo);
  }

  processRoute(filePath, relativePath, routePath) {
    const methods = this.extractHttpMethods(filePath);
    const routeInfo = {
      path: this.normalizeRoutePath(routePath, true),
      methods: methods,
      dynamic: this.isDynamicRoute(routePath),
      groups: this.extractRouteGroups(relativePath),
      guards: this.detectGuards(relativePath),
      source: relativePath,
      description: this.generateDescription(routePath, 'api'),
      params: this.extractParams(routePath),
      config: this.extractRouteConfig(filePath)
    };

    // Validation: route.ts outside /api convention
    const firstSeg = relativePath.split(path.sep)[0];
    if (firstSeg !== 'api') {
      this.meta.warnings.push({ type: 'route_outside_api', file: relativePath, route: routeInfo.path, message: `route.ts outside /api convention: ${relativePath}` });
    }

    // Categorize API routes - all route.ts files are API routes in Next.js App Router
    this.routes.api.push(routeInfo);
  }

  normalizePathSegment(segment, currentPath) {
    // Handle dynamic segments
    if ((segment.startsWith('[') && segment.endsWith(']')) || (segment.startsWith('[[') && segment.endsWith(']]'))) {
      const isOptional = segment.startsWith('[[');
      const inner = isOptional ? segment.slice(2, -2) : segment.slice(1, -1);
      const paramName = inner;
      if (paramName.startsWith('...')) {
        // Catch-all route: [...slug] -> :slug*
        // Optional catch-all [[...slug]] treated same in path representation
        return currentPath ? `${currentPath}/:${paramName.slice(3)}*` : `:${paramName.slice(3)}*`;
      } else {
        // Dynamic route: [id] -> :id
        return currentPath ? `${currentPath}/:${paramName}` : `:${paramName}`;
      }
    }
    
    // Regular segment
    return currentPath ? `${currentPath}/${segment}` : segment;
  }

  normalizeRoutePath(routePath, isApi = false) {
    if (!routePath) return '/';
    
    let path = `/${routePath}`;
    
    // For API routes, ensure they start with /api
    if (isApi && !path.startsWith('/api')) {
      path = `/api${path}`;
    }
    
    return path;
  }

  isDynamicRoute(routePath) {
    return routePath.includes(':') || routePath.includes('*');
  }

  extractParams(routePath) {
    const params = [];
    const segments = routePath.split('/');
    
    for (const segment of segments) {
      if (segment.startsWith(':')) {
        const paramName = segment.slice(1);
        if (paramName.endsWith('*')) {
          params.push(paramName.slice(0, -1));
        } else {
          params.push(paramName);
        }
      }
    }
    
    return params;
  }

  detectGuards(relativePath) {
    const groups = this.extractRouteGroups(relativePath);
    const guardRules = {
      'public': { override: true, guards: [] },
      'marketing': { override: false, guards: [] },
      'authed': { override: false, guards: ['auth'] },
      'ops': { override: false, guards: ['admin'] },
      'owner': { override: false, guards: ['owner'] },
      // neutral group used in ops pages: (app)
      'app': { override: false, guards: [] }
    };

    let guards = [];
    let sawPublic = false;
    for (const group of groups) {
      const rule = guardRules[group];
      if (!rule) {
        // Unknown group: optionally warn but do not affect guards
        this.meta.warnings.push({
          type: 'unknown_group',
          message: `Unknown route group "${group}" in ${relativePath}`,
          file: relativePath,
          group
        });
        continue;
      }
      if (rule.override) {
        guards = [];
        if (group === 'public') sawPublic = true;
      }
      for (const g of rule.guards) {
        if (!guards.includes(g)) guards.push(g);
      }
    }

    // Guard conflict warning: conflicting guarded groups without a public override
    const hasOps = groups.includes('ops');
    const hasAuthed = groups.includes('authed');
    const hasOwner = groups.includes('owner');
    const hasConflict = (hasOps && hasAuthed) || (hasOwner && (hasOps || hasAuthed));
    if (hasConflict) {
      this.meta.warnings.push({
        type: 'guard_conflict',
        message: sawPublic
          ? `Conflicting guarded groups overridden by public group [${groups.join(', ')}] in ${relativePath}`
          : `Conflicting guarded groups [${groups.join(', ')}] in ${relativePath}`,
        file: relativePath,
        groups,
        overridden: sawPublic || undefined
      });
    }

    return guards;
  }

  extractHttpMethods(filePath) {
    const httpMethods = new Set(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD']);
    try {
      const code = fs.readFileSync(filePath, 'utf8');
      const methodsFound = new Set();

      // Fallback to simple string detection if parser is unavailable
      if (!babelParser) {
        for (const m of httpMethods) {
          if (
            code.includes(`export async function ${m}`) ||
            code.includes(`export function ${m}`) ||
            code.includes(`export const ${m}`)
          ) {
            methodsFound.add(m);
          }
        }
        if (methodsFound.size === 0) {
          this.meta.warnings.push({
            type: 'method_detection_failed',
            message: `No HTTP methods detected (no parser)`,
            file: filePath
          });
        }
        return Array.from(methodsFound);
      }

      const ast = babelParser.parse(code, {
        sourceType: 'module',
        plugins: ['typescript', 'jsx']
      });

      for (const node of ast.program.body) {
        // export async function GET() {}
        if (node.type === 'ExportNamedDeclaration' && node.declaration) {
          const decl = node.declaration;
          if (decl.type === 'FunctionDeclaration' && decl.id && httpMethods.has(decl.id.name)) {
            methodsFound.add(decl.id.name);
          }
          if (decl.type === 'VariableDeclaration') {
            for (const d of decl.declarations) {
              if (d.id && d.id.type === 'Identifier' && httpMethods.has(d.id.name)) {
                methodsFound.add(d.id.name);
              }
            }
          }
        }
        // export { GET } from './handler'
        // export { GET as handler } from './handler'
        if (node.type === 'ExportNamedDeclaration' && node.specifiers && node.specifiers.length > 0) {
          for (const spec of node.specifiers) {
            const local = spec.local && spec.local.name;
            const exported = spec.exported && spec.exported.name;
            if (local && httpMethods.has(local)) {
              methodsFound.add(local);
              if (exported && exported !== local) {
                this.meta.warnings.push({
                  type: 'method_reexport_aliased',
                  message: `Aliased method export ${local} as ${exported}`,
                  file: filePath
                });
              }
            } else if (exported && httpMethods.has(exported)) {
              methodsFound.add(exported);
            }
          }
        }
        // export * from './handler' → ambiguous
        if (node.type === 'ExportAllDeclaration') {
          this.meta.warnings.push({
            type: 'method_detection_ambiguous_export_all',
            message: `Ambiguous export-all; cannot resolve methods without module graph`,
            file: filePath
          });
        }
      }

      if (methodsFound.size === 0) {
        this.meta.warnings.push({
          type: 'method_detection_failed',
          message: `No HTTP methods detected`,
          file: filePath
        });
      }

      return Array.from(methodsFound);
    } catch (error) {
      this.meta.warnings.push({
        type: 'method_detection_error',
        message: `Failed to parse for methods: ${error.message}`,
        file: filePath
      });
      return [];
    }
  }

  generateDescription(routePath, type) {
    if (!routePath) return type === 'page' ? 'Homepage' : 'Root API endpoint';
    
    // Generate human-readable description from path
    const parts = routePath.split('/');
    const lastPart = parts[parts.length - 1];
    
    if (type === 'page') {
      if (lastPart && !lastPart.startsWith(':')) {
        return `${lastPart.charAt(0).toUpperCase() + lastPart.slice(1)} page`;
      }
      return 'Page';
    } else {
      if (lastPart && !lastPart.startsWith(':')) {
        return `${lastPart} API endpoint`;
      }
      return 'API endpoint';
    }
  }

  generateAsciiTree() {
    let output = [];
    
    // Pages section
    output.push('== PAGES ==');
    output.push(this.generateTreeForRoutes(this.routes.pages, '/'));
    
    // API Routes section
    output.push('');
    output.push('== API ROUTES ==');
    output.push(this.generateTreeForRoutes(this.routes.api, '/api'));
    
    // Other routes section
    if (this.routes.other.length > 0) {
      output.push('');
      output.push('== OTHER/SYSTEM ==');
      output.push(this.generateTreeForRoutes(this.routes.other, '/'));
    }
    
    return output.join('\n');
  }

  generateTreeForRoutes(routes, basePath) {
    if (routes.length === 0) return basePath;
    
    // For API routes, we need to handle the special case where all routes start with /api
    if (basePath === '/api') {
      // Filter routes that actually belong to this base path
      const apiRoutes = routes.filter(route => route.path.startsWith('/api'));
      if (apiRoutes.length === 0) return basePath;
      
      const tree = this.buildRouteTree(apiRoutes, basePath);
      return this.renderTree(tree, 0);
    }
    
    const tree = this.buildRouteTree(routes, basePath);
    return this.renderTree(tree, 0);
  }

  buildRouteTree(routes, basePath) {
    const tree = { path: basePath, children: [], methods: [], guards: [] };
    
    // Sort routes by path depth
    routes.sort((a, b) => a.path.split('/').length - b.path.split('/').length);
    
    for (const route of routes) {
      this.insertRouteIntoTree(tree, route);
    }
    
    return tree;
  }

  insertRouteIntoTree(tree, route) {
    const parts = route.path.split('/').filter(p => p);
    let current = tree;
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      
      // Skip the base path part
      if (i === 0 && (part === 'api' || part === '')) continue;
      
      let child = current.children.find(c => c.path === part);
      if (!child) {
        child = { 
          path: part, 
          children: [], 
          methods: i === parts.length - 1 ? route.methods : [],
          guards: i === parts.length - 1 ? route.guards : []
        };
        current.children.push(child);
      }
      
      // Update methods and guards for leaf nodes
      if (i === parts.length - 1) {
        child.methods = route.methods;
        child.guards = route.guards;
      }
      
      current = child;
    }
  }

  renderTree(node, level, isLast = true, prefix = '') {
    let output = '';
    
    if (level > 0) {
      const connector = isLast ? '└─' : '├─';
      let line = prefix + connector + ' ' + node.path;
      
      if (node.methods && node.methods.length > 0) {
        line += ` [${node.methods.join(', ')}]`;
      }
      
      if (node.guards && node.guards.length > 0) {
        line += ` (${node.guards.join(', ')})`;
      }
      
      output += line + '\n';
    } else {
      output += node.path + '\n';
    }
    
    const newPrefix = level > 0 ? prefix + (isLast ? '   ' : '│  ') : '';
    
    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i];
      const isLastChild = i === node.children.length - 1;
      output += this.renderTree(child, level + 1, isLastChild, newPrefix);
    }
    
    return output;
  }

  generateMermaidDiagram() {
    let output = ['flowchart TD'];
    const usedIds = new Set();
    const idByPath = new Map();
    const ensureUniqueId = (id, pathLabel) => {
      if (!usedIds.has(id)) {
        usedIds.add(id);
        idByPath.set(pathLabel, id);
        return id;
      }
      let i = 2;
      let newId = `${id}__${i}`;
      while (usedIds.has(newId)) {
        i++;
        newId = `${id}__${i}`;
      }
      usedIds.add(newId);
      idByPath.set(pathLabel, newId);
      this.meta.warnings.push({
        type: 'mermaid_duplicate_id',
        message: `Duplicate Mermaid id '${id}' for '${pathLabel}', renamed to '${newId}'`,
        id,
        newId,
        route: pathLabel
      });
      return newId;
    };
    const classForGuards = (guards) => {
      if (!guards || guards.length === 0) return 'public';
      if (guards.includes('admin')) return 'admin';
      if (guards.includes('owner')) return 'owner';
      if (guards.includes('auth')) return 'auth';
      return 'mixed';
    };
    
    // Pages subgraph
    output.push('    subgraph Pages');
    const pagePaths = new Set(['/']);
    for (const route of this.routes.pages) {
      const baseId = this.sanitizeNodeId(route.path);
      const id = ensureUniqueId(baseId, route.path);
      const label = route.path === '/' ? 'root["/"]' : `${id}["${route.path}"]`;
      output.push(`        ${label}`);
      // Track for edges
      pagePaths.add(route.path);
      const cls = classForGuards(route.guards);
      if (route.path !== '/') output.push(`        class ${id} ${cls};`);
    }
    output.push('    end');
    
    // API subgraph
    if (this.routes.api.length > 0) {
      output.push('    ');
      output.push('    subgraph API');
      const apiRootId = ensureUniqueId(this.sanitizeNodeId('/api'), '/api');
      if (!this.routes.api.some(r => r.path === '/api')) {
        output.push(`        ${apiRootId}["/api"]`);
      }

      const groups = {
        core: this.routes.api.filter(r => r.path.startsWith('/api/') && !r.path.startsWith('/api/v1/') && !r.path.startsWith('/api/test') && !r.path.startsWith('/api/ops') && !r.path.startsWith('/api/owner') && r.path !== '/api'),
        v1: this.routes.api.filter(r => r.path.startsWith('/api/v1/')),
        test: this.routes.api.filter(r => r.path.startsWith('/api/test')),
        ops: this.routes.api.filter(r => r.path.startsWith('/api/ops')),
        owner: this.routes.api.filter(r => r.path.startsWith('/api/owner')),
      };

      const emitGroup = (title, items) => {
        if (items.length === 0) return;
        output.push(`        subgraph ${title}`);
        for (const route of items) {
          const baseId = this.sanitizeNodeId(route.path);
          const id = ensureUniqueId(baseId, route.path);
          const label = `${id}["${route.path}"]`;
          output.push(`            ${label}`);
          const cls = classForGuards(route.guards);
          output.push(`            class ${id} ${cls};`);
        }
        output.push('        end');
      };

      emitGroup('Core', groups.core);
      emitGroup('v1', groups.v1);
      emitGroup('Test', groups.test);
      emitGroup('Ops', groups.ops);
      emitGroup('Owner', groups.owner);

      output.push('    end');
    }
    
    // Other routes subgraph
    if (this.routes.other.length > 0) {
      output.push('    ');
      output.push('    subgraph Other');
      for (const route of this.routes.other) {
        const baseId = this.sanitizeNodeId(route.path);
        const id = ensureUniqueId(baseId, route.path);
        const label = `${id}["${route.path}"]`;
        output.push(`        ${label}`);
      }
      output.push('    end');
    }
    // Edges for Pages
    const addEdges = (paths, base) => {
      const items = Array.from(paths).sort((a, b) => a.length - b.length);
      for (const p of items) {
        if (p === base) continue;
        const lastSlash = p.lastIndexOf('/');
        const parent = lastSlash > 0 ? p.slice(0, lastSlash) : base;
        const parentPath = parent || base;
        const parentId = idByPath.get(parentPath);
        const childId = idByPath.get(p);
        if (parentId && childId) output.push(`    ${parentId} --> ${childId}`);
      }
    };
    addEdges(pagePaths, '/');

    // Edges for API
    const apiPaths = new Set(['/api']);
    for (const r of this.routes.api) apiPaths.add(r.path);
    addEdges(apiPaths, '/api');

    // Styling for guard levels
    output.push('    classDef public stroke:#16a34a,stroke-width:2px;');
    output.push('    classDef auth stroke:#2563eb,stroke-width:2px;');
    output.push('    classDef admin stroke:#dc2626,stroke-width:2px;');
    output.push('    classDef owner stroke:#7c3aed,stroke-width:2px;');
    output.push('    classDef mixed stroke:#f59e0b,stroke-width:2px;');

    return output.join('\n');
  }

  sanitizeNodeId(path) {
    return path.replace(/[^a-zA-Z0-9]/g, '_').replace(/^_+|_+$/g, '') || 'root';
  }

  extractRouteGroups(relativePath) {
    if (!relativePath) return [];
    const segments = relativePath.split(path.sep);
    const groups = [];
    for (const seg of segments) {
      if (seg.startsWith('(') && seg.endsWith(')')) {
        const name = seg.slice(1, -1).trim();
        if (name) groups.push(name.toLowerCase());
      }
    }
    return groups;
  }

  extractRouteConfig(filePath) {
    const config = {};
    if (!babelParser) return config;
    try {
      const code = fs.readFileSync(filePath, 'utf8');
      const ast = babelParser.parse(code, { sourceType: 'module', plugins: ['typescript', 'jsx'] });
      const knownKeys = new Set(['dynamic', 'revalidate', 'fetchCache', 'runtime', 'preferredRegion']);
      for (const node of ast.program.body) {
        if (node.type === 'ExportNamedDeclaration' && node.declaration && node.declaration.type === 'VariableDeclaration') {
          for (const d of node.declaration.declarations) {
            if (d.id && d.id.type === 'Identifier' && knownKeys.has(d.id.name)) {
              const key = d.id.name;
              let val = null;
              const init = d.init;
              if (!init) continue;
              if (init.type === 'StringLiteral') val = init.value;
              else if (init.type === 'NumericLiteral') val = init.value;
              else if (init.type === 'BooleanLiteral') val = init.value;
              else if (init.type === 'NullLiteral') val = null;
              else {
                // fallback textual repr for complex expressions
                val = undefined;
              }
              config[key] = val;
            }
          }
        }
      }
    } catch (e) {
      this.meta.warnings.push({ type: 'config_parse_error', file: filePath, message: `Failed to parse config exports: ${e.message}` });
    }
    return config;
  }

  generateJson() {
    return JSON.stringify({
      pages: this.routes.pages,
      api: this.routes.api,
      other: this.routes.other,
      meta: this.meta
    }, null, 2);
  }
}

// Run the scanner
if (require.main === module) {
  const args = process.argv.slice(2);
  const docsOnly = args.includes('--docs-only');
  const strict = args.includes('--strict');

  if (docsOnly) {
    // Only regenerate docs from existing route-map.json
    try {
      const gen = require('./scripts/generate-route-docs.js');
      gen.main(path.resolve(process.cwd(), 'route-map.json'));
      console.log('Docs regenerated from route-map.json');
      process.exit(0);
    } catch (e) {
      console.error('Failed to regenerate docs:', e.message);
      process.exit(1);
    }
  }

  const scanner = new RouteScanner();
  const routes = scanner.scan();
  
  // Save outputs to files
  fs.writeFileSync('route-map-ascii.txt', scanner.generateAsciiTree());
  const mermaid = scanner.generateMermaidDiagram();
  fs.writeFileSync('route-map-mermaid.md', '```mermaid\n' + mermaid + '\n```');
  fs.writeFileSync('route-map.json', scanner.generateJson());

  // Generate docs from fresh outputs
  try {
    const gen = require('./scripts/generate-route-docs.js');
    gen.main(path.resolve(process.cwd(), 'route-map.json'));
  } catch (e) {
    console.warn('Doc generation failed:', e.message);
  }
  
  console.log('Route mapping complete!');
  console.log(`- ASCII tree saved to: route-map-ascii.txt`);
  console.log(`- Mermaid diagram saved to: route-map-mermaid.md`);
  console.log(`- JSON data saved to: route-map.json`);
  console.log(`\nTotal routes found: ${routes.pages.length + routes.api.length + routes.other.length}`);
  console.log(`- Pages: ${routes.pages.length}`);
  console.log(`- API routes: ${routes.api.length}`);
  console.log(`- Other: ${routes.other.length}`);

  if (strict) {
    const warningsCount = scanner.meta.warnings.length;
    if (warningsCount > 0) {
      console.error(`--strict: ${warningsCount} warnings detected. Failing.`);
      process.exit(1);
    }
  }
}

module.exports = RouteScanner;
