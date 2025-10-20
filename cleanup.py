#!/usr/bin/env python3

"""
SajiloReserveX Advanced Cleanup Script
====================================

Provides intelligent cleanup of legacy code, tests, and documentation.
Supports dry-run mode and interactive confirmation.

Usage:
    python3 cleanup.py [--force] [--dry-run] [--interactive]
    
Options:
    --force        Skip confirmation prompts
    --dry-run      Show what would be deleted without deleting
    --interactive  Ask for each deletion individually
"""

import os
import sys
import shutil
import argparse
from pathlib import Path
from typing import List, Tuple
from dataclasses import dataclass
import json


@dataclass
class FilePattern:
    """Represents a file pattern to clean"""
    pattern: str
    description: str
    category: str
    recursive: bool = True


class ProjectCleaner:
    """Handles cleanup of legacy code and test files"""
    
    # ANSI color codes
    COLORS = {
        'info': '\033[0;34m',      # Blue
        'success': '\033[0;32m',   # Green
        'warning': '\033[1;33m',   # Yellow
        'error': '\033[0;31m',     # Red
        'reset': '\033[0m',        # Reset
    }
    
    # Files to keep (whitelist)
    KEEP_FILES = {
        'README.md',
        'CONTRIBUTING.md',
        'LICENSE.md',
    }
    
    def __init__(self, project_root: str, force: bool = False, dry_run: bool = False, interactive: bool = False):
        """Initialize the cleaner"""
        self.project_root = Path(project_root)
        self.force = force
        self.dry_run = dry_run
        self.interactive = interactive
        self.deleted_count = 0
        self.total_size_freed = 0
        self.errors = []
        
        # Patterns to clean
        self.patterns = [
            # Test files
            FilePattern('*.test.ts', 'TypeScript test files', 'tests'),
            FilePattern('*.test.tsx', 'React test files', 'tests'),
            FilePattern('*.spec.ts', 'TypeScript spec files', 'tests'),
            FilePattern('*.spec.tsx', 'React spec files', 'tests'),
            FilePattern('*.test.js', 'JavaScript test files', 'tests'),
            FilePattern('*.spec.js', 'JavaScript spec files', 'tests'),
        ]
        
        # Directories to remove
        self.directories_to_remove = [
            ('backups', 'Backup directory'),
            ('.reserve-dist', 'Reserve distribution cache'),
            ('playwright-report', 'Playwright test reports'),
            ('test-results', 'Test results directory'),
            ('reports', 'Reports directory'),
            ('.qodo', 'Qodo cache directory'),
        ]
        
        # Individual files to remove
        self.files_to_remove = [
            ('playwright.component.config.ts', 'Playwright component config'),
            ('vitest.config.ts', 'Vitest configuration'),
            ('test-email.mjs', 'Legacy test email script'),
            ('squash_migrations.sh', 'Migration squash script'),
            ('restaurant.json', 'Sample restaurant data'),
        ]
    
    def _print(self, level: str, message: str):
        """Print colored message"""
        color = self.COLORS.get(level, self.COLORS['info'])
        reset = self.COLORS['reset']
        
        if level == 'info':
            prefix = f"{color}ℹ{reset}"
        elif level == 'success':
            prefix = f"{color}✓{reset}"
        elif level == 'warning':
            prefix = f"{color}⚠{reset}"
        elif level == 'error':
            prefix = f"{color}✗{reset}"
        else:
            prefix = ""
        
        if prefix:
            print(f"{prefix} {message}")
        else:
            print(message)
    
    def _confirm(self, message: str) -> bool:
        """Ask user for confirmation"""
        if self.force:
            return True
        
        response = input(f"{message} (y/n) ").strip().lower()
        return response in ['y', 'yes']
    
    def _get_file_size(self, path: Path) -> int:
        """Get total size of file or directory"""
        if path.is_file():
            return path.stat().st_size
        
        total = 0
        try:
            for entry in path.rglob('*'):
                if entry.is_file():
                    total += entry.stat().st_size
        except (OSError, PermissionError):
            pass
        return total
    
    def _format_size(self, size_bytes: int) -> str:
        """Format bytes to human readable"""
        for unit in ['B', 'KB', 'MB', 'GB']:
            if size_bytes < 1024.0:
                return f"{size_bytes:.1f} {unit}"
            size_bytes /= 1024.0
        return f"{size_bytes:.1f} TB"
    
    def _delete_item(self, path: Path, description: str) -> bool:
        """Delete a file or directory"""
        try:
            if self.dry_run:
                size = self._get_file_size(path)
                self._print('info', f"[DRY RUN] Would delete: {description} ({self._format_size(size)})")
                return True
            
            if self.interactive or not self.force:
                if not self._confirm(f"Delete {description}?"):
                    return False
            
            size = self._get_file_size(path)
            
            if path.is_file():
                path.unlink()
            else:
                shutil.rmtree(path)
            
            self.deleted_count += 1
            self.total_size_freed += size
            self._print('success', f"Deleted: {description} ({self._format_size(size)})")
            return True
            
        except (OSError, PermissionError) as e:
            self.errors.append(f"Failed to delete {description}: {e}")
            self._print('error', f"Failed to delete {description}: {e}")
            return False
    
    def clean_patterns(self):
        """Delete files matching patterns"""
        self._print('warning', "→ Removing Test Files")
        
        for pattern in self.patterns:
            if self.dry_run:
                files = list(self.project_root.rglob(pattern.pattern))
                # Filter out node_modules
                files = [f for f in files if 'node_modules' not in f.parts]
                if files:
                    total_size = sum(self._get_file_size(f) for f in files)
                    self._print('info', 
                        f"[DRY RUN] Would delete {len(files)} files matching '{pattern.pattern}' "
                        f"({self._format_size(total_size)})")
            else:
                count = 0
                total_size = 0
                
                for file_path in self.project_root.rglob(pattern.pattern):
                    if 'node_modules' in file_path.parts:
                        continue
                    
                    total_size += self._get_file_size(file_path)
                    if self._delete_item(file_path, f"{pattern.description} ({file_path.relative_to(self.project_root)})"):
                        count += 1
                
                if count > 0 and not self.dry_run:
                    self._print('success', f"Deleted {count} files ({self._format_size(total_size)})")
        
        print()
    
    def clean_directories(self):
        """Delete specific directories"""
        self._print('warning', "→ Removing Directories")
        
        for dir_name, description in self.directories_to_remove:
            dir_path = self.project_root / dir_name
            if dir_path.exists():
                self._delete_item(dir_path, description)
        
        print()
    
    def clean_files(self):
        """Delete specific files"""
        self._print('warning', "→ Removing Individual Files")
        
        for file_name, description in self.files_to_remove:
            file_path = self.project_root / file_name
            if file_path.exists():
                self._delete_item(file_path, description)
        
        print()
    
    def clean_markdown_files(self):
        """Delete markdown files (except whitelisted)"""
        self._print('warning', "→ Removing Documentation Files (.md)")
        
        md_files = list(self.project_root.glob('*.md'))
        
        if self.dry_run:
            to_delete = [f for f in md_files if f.name not in self.KEEP_FILES]
            if to_delete:
                total_size = sum(self._get_file_size(f) for f in to_delete)
                self._print('info', 
                    f"[DRY RUN] Would delete {len(to_delete)} markdown files "
                    f"({self._format_size(total_size)})")
        else:
            for md_file in md_files:
                if md_file.name not in self.KEEP_FILES:
                    self._delete_item(md_file, f"Markdown file ({md_file.name})")
        
        print()
    
    def run(self):
        """Execute the cleanup"""
        print()
        print(f"{self.COLORS['info']}╔════════════════════════════════════════════════════════╗{self.COLORS['reset']}")
        print(f"{self.COLORS['info']}║    SajiloReserveX Advanced Cleanup Script              ║{self.COLORS['reset']}")
        print(f"{self.COLORS['info']}╚════════════════════════════════════════════════════════╝{self.COLORS['reset']}")
        print()
        
        if self.dry_run:
            self._print('warning', "DRY RUN MODE - No files will be deleted")
            print()
        
        self._print('info', f"Project root: {self.project_root}")
        print()
        
        # Run cleanups
        self.clean_patterns()
        self.clean_directories()
        self.clean_files()
        self.clean_markdown_files()
        
        # Print summary
        self._print_summary()
    
    def _print_summary(self):
        """Print cleanup summary"""
        print(f"{self.COLORS['info']}╔════════════════════════════════════════════════════════╗{self.COLORS['reset']}")
        if self.dry_run:
            print(f"{self.COLORS['info']}║    DRY RUN SUMMARY - No files were deleted            ║{self.COLORS['reset']}")
        else:
            print(f"{self.COLORS['info']}║            Cleanup Complete!                         ║{self.COLORS['reset']}")
        print(f"{self.COLORS['info']}╚════════════════════════════════════════════════════════╝{self.COLORS['reset']}")
        print()
        
        if not self.dry_run:
            self._print('success', f"Total items deleted: {self.deleted_count}")
            self._print('success', f"Space freed: {self._format_size(self.total_size_freed)}")
        
        if self.errors:
            print()
            self._print('warning', f"Encountered {len(self.errors)} error(s):")
            for error in self.errors:
                self._print('error', error)
        
        print()
        self._print('info', "Next steps:")
        print("  1. Review any remaining legacy files")
        print("  2. Run: npm install (or pnpm install) to verify dependencies")
        print("  3. Run: npm run build to verify the project still builds")
        print()


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description='Clean up legacy code, test files, and documentation'
    )
    parser.add_argument(
        '--force',
        action='store_true',
        help='Skip confirmation prompts'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Show what would be deleted without actually deleting'
    )
    parser.add_argument(
        '--interactive',
        action='store_true',
        help='Ask for each deletion individually'
    )
    
    args = parser.parse_args()
    
    project_root = '/Users/amankumarshrestha/Downloads/SajiloReserveX'
    
    if not Path(project_root).exists():
        print(f"Error: Project root not found: {project_root}")
        sys.exit(1)
    
    cleaner = ProjectCleaner(
        project_root=project_root,
        force=args.force,
        dry_run=args.dry_run,
        interactive=args.interactive
    )
    
    try:
        cleaner.run()
        sys.exit(0 if not cleaner.errors else 1)
    except KeyboardInterrupt:
        print("\n\nCleanup cancelled by user")
        sys.exit(1)
    except Exception as e:
        print(f"\nFatal error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
