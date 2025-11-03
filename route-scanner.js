#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

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
    this.meta.total_routes = this.routes.pages.length + this.routes.api.length + this.routes.other.length;
    return this.routes;
  }

  scanDirectory(dirPath, routePath) {
    if (!fs.existsSync(dirPath)) return;

    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      const relativePath = path.relative(this.basePath, fullPath);

      // Skip route groups in the final path but process their contents
      if (entry.isDirectory() && entry.name.startsWith('(') && entry.name.endsWith(')')) {
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
      guards: this.detectGuards(relativePath),
      source: relativePath,
      description: this.generateDescription(routePath, 'page'),
      params: this.extractParams(routePath)
    };

    this.routes.pages.push(routeInfo);
  }

  processRoute(filePath, relativePath, routePath) {
    const methods = this.extractHttpMethods(filePath);
    const routeInfo = {
      path: this.normalizeRoutePath(routePath, true),
      methods: methods,
      dynamic: this.isDynamicRoute(routePath),
      guards: this.detectGuards(relativePath),
      source: relativePath,
      description: this.generateDescription(routePath, 'api'),
      params: this.extractParams(routePath)
    };

    // Categorize API routes - all route.ts files are API routes in Next.js App Router
    this.routes.api.push(routeInfo);
  }

  normalizePathSegment(segment, currentPath) {
    // Handle dynamic segments
    if (segment.startsWith('[') && segment.endsWith(']')) {
      const paramName = segment.slice(1, -1);
      if (paramName.startsWith('...')) {
        // Catch-all route: [...slug] -> :slug*
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
    const guards = [];
    
    // Detect route group based guards
    if (relativePath.includes('(authed)')) {
      guards.push('auth');
    }
    if (relativePath.includes('(ops)')) {
      guards.push('admin');
    }
    
    // TODO: Could add more sophisticated detection based on file contents
    // For now, this covers the basic route group patterns
    
    return guards;
  }

  extractHttpMethods(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const methods = [];
      
      // Look for exported HTTP method functions
      const httpMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'];
      
      for (const method of httpMethods) {
        if (content.includes(`export async function ${method}`) || 
            content.includes(`export function ${method}`) ||
            content.includes(`export const ${method}`) ||
            content.includes(`export async ${method}`)) {
          methods.push(method);
        }
      }
      
      // Default to GET if no methods found (common pattern)
      if (methods.length === 0) {
        methods.push('GET');
      }
      
      return methods;
    } catch (error) {
      console.warn(`Could not read file ${filePath}:`, error.message);
      return ['GET'];
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
    
    // Pages subgraph
    output.push('    subgraph Pages');
    for (const route of this.routes.pages) {
      const id = this.sanitizeNodeId(route.path);
      const label = route.path === '/' ? 'root["/"]' : `${id}["${route.path}"]`;
      output.push(`        ${label}`);
    }
    output.push('    end');
    
    // API subgraph
    if (this.routes.api.length > 0) {
      output.push('    ');
      output.push('    subgraph API');
      for (const route of this.routes.api) {
        const id = this.sanitizeNodeId(route.path);
        const label = route.path === '/api' ? 'api["/api"]' : `${id}["${route.path}"]`;
        output.push(`        ${label}`);
      }
      output.push('    end');
    }
    
    // Other routes subgraph
    if (this.routes.other.length > 0) {
      output.push('    ');
      output.push('    subgraph Other');
      for (const route of this.routes.other) {
        const id = this.sanitizeNodeId(route.path);
        const label = `${id}["${route.path}"]`;
        output.push(`        ${label}`);
      }
      output.push('    end');
    }
    
    return output.join('\n');
  }

  sanitizeNodeId(path) {
    return path.replace(/[^a-zA-Z0-9]/g, '_').replace(/^_+|_+$/g, '') || 'root';
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
  const scanner = new RouteScanner();
  const routes = scanner.scan();
  
  // Save outputs to files
  fs.writeFileSync('route-map-ascii.txt', scanner.generateAsciiTree());
  fs.writeFileSync('route-map-mermaid.md', '```mermaid\n' + scanner.generateMermaidDiagram() + '\n```');
  fs.writeFileSync('route-map.json', scanner.generateJson());
  
  console.log('Route mapping complete!');
  console.log(`- ASCII tree saved to: route-map-ascii.txt`);
  console.log(`- Mermaid diagram saved to: route-map-mermaid.md`);
  console.log(`- JSON data saved to: route-map.json`);
  console.log(`\nTotal routes found: ${routes.pages.length + routes.api.length + routes.other.length}`);
  console.log(`- Pages: ${routes.pages.length}`);
  console.log(`- API routes: ${routes.api.length}`);
  console.log(`- Other: ${routes.other.length}`);
}

module.exports = RouteScanner;